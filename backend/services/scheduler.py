from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
import os
import time
import logging
from datetime import datetime

from ..database import SessionLocal
from ..models import Specification, MarketPrice, ProductModel
from .carousell_scraper import CarousellScraper
from .valuation_scraper import ValuationScraper
from .product_service import ProductService
from .telegram_service import TelegramService

class SchedulerService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.carousell = CarousellScraper()
        self.valuation = ValuationScraper()
        self.telegram = TelegramService()
        self.is_crawling = False
        self.is_ai_running = False
        self.is_paused = True
        self.consecutive_502_count = 0
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger("Scheduler")
        self.last_403_time = 0 # Unix timestamp of last 403 error

    def check_403_backoff(self) -> bool:
        """Check if we are currently in a 15-minute backoff period due to 403"""
        if self.last_403_time == 0:
            return False
        
        elapsed = time.time() - self.last_403_time
        if elapsed < 900: # 15 minutes
            remaining = int((900 - elapsed) / 60)
            self.logger.warning(f"403 Backoff Active: Skipping action. {remaining} mins remaining.")
            return True
        
        # Backoff expired
        self.last_403_time = 0
        return False

    def sync_valuation_url(self, db, url: str, category_id: int):
        if self.is_paused or self.check_403_backoff():
            self.logger.info("Sync skipped: Crawler is paused or in 403 backoff.")
            return 0
        self.logger.info(f"Syncing {url}...")
        try:
            results = self.valuation.scrape_dynamic_url(url)
        except RuntimeError as e:
            if str(e) == "FORBIDDEN_403":
                self.logger.error(f"403 Forbidden detected during valuation sync. Entering 15min backoff.")
                self.last_403_time = int(time.time())
            return 0
        except Exception as e:
            self.logger.error(f"Valuation sync failed: {e}")
            return 0

        if not results: return 0
        
        source = "US3C" if "us3c.com.tw" in url else "Sogo3C"
        count = 0
        from ..models import ProductModel, Specification, MarketPrice
        for data in results:
            raw_model_name = data['model']
            raw_spec_name = data['specs']
            if not raw_model_name: continue
            
            # Normalize names to prevent duplicates due to whitespace/case
            model_name = raw_model_name.strip()
            spec_name = raw_spec_name.strip() if raw_spec_name else "Standard"
            
            model = db.query(ProductModel).filter(
                ProductModel.category_id == category_id,
                ProductModel.name == model_name
            ).first()
            if not model:
                model = ProductModel(category_id=category_id, name=model_name)
                db.add(model)
                db.commit()
                db.refresh(model)
                
            spec = db.query(Specification).filter(
                Specification.model_id == model.id,
                Specification.name == spec_name
            ).first()
            if not spec:
                spec = Specification(model_id=model.id, name=spec_name)
                db.add(spec)
                db.commit()
                db.refresh(spec)
                
            # Update or Create MarketPrice
            existing_price = db.query(MarketPrice).filter(
                MarketPrice.specification_id == spec.id,
                MarketPrice.source == source
            ).first()
            
            if existing_price:
                existing_price.price = data['price']
                existing_price.updated_at = datetime.now()
            else:
                new_price = MarketPrice(
                    specification_id=spec.id,
                    price=data['price'],
                    source=source
                )
                db.add(new_price)
            count += 1
            
        db.commit()
        return count

    def update_market_prices(self):
        """Update market prices for all tracked dynamic URLs"""
        db = SessionLocal()
        try:
            from ..models import SystemConfig
            import json
            
            default_urls = [
                {"url": "https://www.us3c.com.tw/promotion-recycle-phones", "category_id": 1},
                {"url": "https://sogo3cphone.com/product/detail/31", "category_id": 1},
                {"url": "https://sogo3cphone.com/product/detail/55", "category_id": 2},
                {"url": "https://sogo3cphone.com/product/detail/54", "category_id": 2},
                {"url": "https://sogo3cphone.com/product/detail/56", "category_id": 2},
                {"url": "https://www.us3c.com.tw/promotion-recycle-ipad", "category_id": 2},
                {"url": "https://www.us3c.com.tw/promotion-recycle-macbook-air", "category_id": 3},
                {"url": "https://sogo3cphone.com/product/detail/58", "category_id": 3},
                {"url": "https://sogo3cphone.com/product/detail/57", "category_id": 3},
                {"url": "https://www.us3c.com.tw/promotion-recycle-macbook-pro", "category_id": 3}
            ]
            
            conf = db.query(SystemConfig).filter(SystemConfig.key == "valuation_urls").first()
            custom_urls = json.loads(conf.value) if conf and conf.value else []
            
            all_targets = default_urls.copy()
            for cu in custom_urls:
                if not any(d['url'] == cu['url'] for d in all_targets):
                    all_targets.append(cu)
                    
            import random
            for target in all_targets:
                if self.is_paused or self.check_403_backoff():
                    self.logger.info("Market price update paused or in 403 backoff.")
                    break

                # Add jitter between portal scrapes
                wait = random.uniform(5.0, 15.0)
                self.logger.info(f"Jitter: Waiting {wait:.1f}s before scraping {target['url']}...")
                time.sleep(wait)
                
                self.sync_valuation_url(db, target['url'], target['category_id'])
                
            self.logger.info("Finished market price sync.")
        finally:
            db.close()

    def crawl_products(self):
        """Periodic crawl for potential profit items"""
        if self.is_crawling:
            self.logger.info("Crawl already in progress. Skipping.")
            return
        db = SessionLocal()
        product_service = ProductService(db)
        self.is_crawling = True
        
        # Track consecutive 502s across the entire crawl session
        self.consecutive_502_count = 0 

        try:
            # Get only specifications we are monitoring
            specs = db.query(Specification).filter(Specification.is_monitored == True).all()
            for spec in specs:
                if self.is_paused or self.check_403_backoff():
                    self.logger.info("Crawling paused or in 403 backoff by system.")
                    break
                    
                model_name = spec.model.name
                query = f"{model_name} {spec.name}"
                
                # Dynamic resting period based on stealth level
                import random
                stealth_level = product_service.get_config("crawler_stealth_level", "high")
                
                if stealth_level == "high":
                    wait_time = random.uniform(30.0, 90.0)
                else:
                    wait_time = random.uniform(5.0, 15.0)
                    
                self.logger.info(f"Stealth resting ({stealth_level}) for {wait_time:.1f}s before next search...")
                for _ in range(int(wait_time)):
                    if self.is_paused: break
                    time.sleep(1)
                if self.is_paused: break

                self.logger.info(f"Executing Carousell Search: {query}...")
                try:
                    items = self.carousell.search(query)
                    # If search succeeds (no exception), reset 502 count
                    self.consecutive_502_count = 0 
                    self.logger.info(f"Found {len(items)} items for {query}.")
                except RuntimeError as e:
                    if str(e) == "FORBIDDEN_403":
                        self.logger.error("403 Forbidden detected. Entering 15min backoff.")
                        self.last_403_time = int(time.time())
                        break # Stop current crawl session
                    raise e
                except Exception as e:
                    err_msg = str(e)
                    if err_msg == "PERSISTENT_502":
                        self.consecutive_502_count += 1
                        self.logger.warning(f"502 detected. Consecutive count: {self.consecutive_502_count}")
                        if self.consecutive_502_count >= 10:
                            self.logger.error(f"Reached 10 consecutive 502 errors. Pausing.")
                            self.is_paused = True
                            self.consecutive_502_count = 0
                            break
                        continue # Move to next spec
                    else:
                        self.logger.error(f"Search failed for {query}: {e}")
                        continue
                
                for item in items:
                    self.logger.info(f"  > Processing: {item['title']} - NT${item['price']}")
                    product = product_service.process_scraped_item(spec.id, "Carousell", item)
                    if product and product.is_potential_profit and not product.ai_summary:
                        # 1. AI Summarize
                        self.is_ai_running = True
                        try:
                            summary = product_service.generate_ai_summary(product)
                        finally:
                            self.is_ai_running = False
                        # 2. Telegram Notify
                        if summary:
                            profit = 0 # Calculate based on benchmark
                            benchmark = db.query(MarketPrice).filter(
                                MarketPrice.specification_id == spec.id
                            ).order_by(MarketPrice.updated_at.desc()).first()
                            
                            if benchmark:
                                profit = benchmark.price - item['price']
                            
                            # Check profit threshold from config
                            threshold_str = product_service.get_config("telegram_profit_threshold", "0")
                            try:
                                threshold = float(threshold_str)
                            except:
                                threshold = 0
                                
                            if profit >= threshold:
                                msg = self.telegram.format_product_message(product, f"{model_name} {spec.name}", profit)
                                self.telegram.send_notification(msg)
                
                # Short safe sleep between processing found items
                time.sleep(2)
        finally:
            self.is_crawling = False
            db.close()

    def run_ai_predictions(self):
        """Hourly task to update market price predictions"""
        if self.is_ai_running: return
        db = SessionLocal()
        self.is_ai_running = True
        try:
            product_service = ProductService(db)
            self.logger.info("Starting hourly AI Market Price Prediction...")
            product_service.calculate_ai_predictions()
            self.logger.info("Finished AI Market Price Prediction.")
        finally:
            self.is_ai_running = False
            db.close()

    def sweep_missing_summaries(self):
        """Task to process potential profit items missing summaries"""
        if self.is_ai_running: return
        db = SessionLocal()
        self.is_ai_running = True
        try:
            product_service = ProductService(db)
            self.logger.info("Starting AI Summary Sweep...")
            count = product_service.sweep_missing_summaries(limit=10) # Process 10 at a time
            self.logger.info(f"Processed {count} missing AI summaries.")
        finally:
            self.is_ai_running = False
            db.close()

    def sweep_metadata_enrichment(self):
        """Task to fetch detailed descriptions for high-potential items"""
        db = SessionLocal()
        try:
            product_service = ProductService(db)
            self.logger.info("Starting Metadata Enrichment Sweep...")
            count = product_service.sweep_missing_details(limit=5) # Process 5 at a time to be safe
            self.logger.info(f"Enriched {count} items with detailed metadata.")
        finally:
            db.close()

    def reload_intervals(self):
        """重新從數據庫讀取設定並調整排程間隔"""
        db = SessionLocal()
        try:
            from .product_service import ProductService
            ps = ProductService(db)
            
            # Read intervals from config
            crawl_mins = int(ps.get_config("crawl_interval_mins", "30"))
            ai_hours = int(ps.get_config("ai_prediction_interval_hours", "1"))
            summary_mins = int(ps.get_config("summary_sweep_interval_mins", "10"))
            enrich_mins = int(ps.get_config("metadata_enrichment_interval_mins", "15"))

            self.logger.info(f"Reloading Intervals: Crawl={crawl_mins}m, AI={ai_hours}h, Summary={summary_mins}m, Enrich={enrich_mins}m")

            # Reschedule or add jobs
            def update_job(job_id, func, interval_type, val):
                try:
                    trigger_args = {interval_type: val}
                    if self.scheduler.get_job(job_id):
                        self.scheduler.reschedule_job(job_id, trigger='interval', **trigger_args)
                    else:
                        self.scheduler.add_job(func, 'interval', id=job_id, **trigger_args)
                except Exception as e:
                    self.logger.error(f"Failed to update job {job_id}: {e}")

            update_job('crawl_products', self.crawl_products, 'minutes', crawl_mins)
            update_job('run_ai_predictions', self.run_ai_predictions, 'hours', ai_hours)
            update_job('sweep_missing_summaries', self.sweep_missing_summaries, 'minutes', summary_mins)
            update_job('sweep_metadata_enrichment', self.sweep_metadata_enrichment, 'minutes', enrich_mins)

        except Exception as e:
            self.logger.error(f"Reload intervals failed: {e}")
        finally:
            db.close()

    def start(self):
        # 1. Weekly Market Price Update (Keep cron for now)
        self.scheduler.add_job(self.update_market_prices, 'cron', day_of_week='mon', hour=0, id='update_market_prices')
        
        # 2-5. Interval jobs - use reload logic to initialize
        self.reload_intervals()
        
        self.scheduler.start()
