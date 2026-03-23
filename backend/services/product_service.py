from sqlalchemy.orm import Session
from datetime import datetime
from ..models import ScrapedProduct, MarketPrice, Specification, SystemConfig
import requests
import time
import random
import json
from ..config_utils import get_config_value

class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def get_config(self, key: str, default: str = None) -> str:
        return get_config_value(key, default)

    def get_market_benchmark(self, spec_id: int) -> float:
        """Centralized logic: Manual Price > Portal Max"""
        benchmarks = self.db.query(MarketPrice).filter(
            MarketPrice.specification_id == spec_id
        ).all()
        manual_price = next((b.price for b in benchmarks if b.source == "Manual"), None)
        if manual_price: return manual_price
        
        portal_prices = [b.price for b in benchmarks if b.source != "Manual"]
        return max(portal_prices) if portal_prices else 0

    def get_target_price(self, spec: Specification) -> float:
        """Centralized logic: Benchmark * (1 + Margin)"""
        base_quote = self.get_market_benchmark(spec.id)
        if base_quote <= 0: return 0
        
        # Apply Custom Margin (Hierarchy: Spec > Category > Default)
        if spec.custom_margin is not None:
            margin = spec.custom_margin
        elif spec.model and spec.model.category and spec.model.category.custom_margin is not None:
            margin = spec.model.category.custom_margin
        else:
            margin = 5.0
            
        return base_quote * (1 + margin / 100.0)

    def process_scraped_item(self, spec_id: int, platform: str, item_data: dict):
        # Record scanned count
        self.record_stat(scanned=1)
        
        spec = self.db.query(Specification).filter(Specification.id == spec_id).first()
        if not spec: return

        # Keyword filtering for computers
        category_name = spec.model.category.name if spec.model and spec.model.category else ""
        if category_name == "筆記型電腦" or "MacBook" in spec.model.name:
            # Ensure all keywords from spec name (e.g. "M1 MAX", "32G") are in the title
            spec_keywords = [k.strip().lower() for k in spec.name.replace('/', ' ').split() if len(k.strip()) > 1]
            title_lower = item_data['title'].lower()
            if not all(k in title_lower for k in spec_keywords):
                self.record_stat(filtered=1)
                return None
        else:
            # Basic keyword check for other categories (e.g. Phones)
            model_keywords = [k.strip().lower() for k in spec.model.name.split() if len(k.strip()) > 1]
            title_lower = item_data['title'].lower()
            if not all(k in title_lower for k in model_keywords):
                self.record_stat(filtered=1)
                return None

        # 1. Determine Target Market Price (using centralized logic)
        target_market_price = self.get_target_price(spec)
        base_quote = self.get_market_benchmark(spec_id)
        
        price = item_data['price']
        
        # 2. Price Sanity Check (Accessories/Scams/Faulty)
        # If price is suspiciously low (< 30% of market base), it's probably not the actual device
        if base_quote > 0 and price < (base_quote * 0.3):
            self.record_stat(filtered=1)
            return None

        if target_market_price <= 0:
            self.record_stat(filtered=1)
            return None # Cannot evaluate

        profit = target_market_price - price

        profit = target_market_price - price

        is_potential = (profit > 0)

        # 5. Save/Update Check (Deduplication & Soft Delete)
        existing = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.external_id == item_data['external_id'],
            ScrapedProduct.platform == platform
        ).first()

        # If user ignored this item previously, skip it completely
        if existing and existing.is_ignored_by_user:
            self.record_stat(filtered=1)
            return existing

        # If it's a new potential hit, OR an existing potential hit without description, fetch details
        should_fetch_details = is_potential and (not existing or not existing.description)
        details = {}
        if should_fetch_details:
            if platform == "Carousell":
                from .carousell_scraper import CarousellScraper
                scraper = CarousellScraper()
                details = scraper.get_item_details(item_data['url'])
            elif platform == "Yahoo Auction":
                from .yahoo_scraper import YahooScraper
                scraper = YahooScraper()
                details = scraper.get_item_details(item_data['url'])
                
            # Note: We now do AI verification later, so no detect_anomaly here
                
        if is_potential:
            self.record_stat(potential=1)
        else:
            self.record_stat(filtered=1)

        if existing:
            existing.price = price
            # Only update potential profit if it wasn't already evaluated, or if price changed drastically
            # But let's trust our new calculation
            existing.is_potential_profit = is_potential
            if details:
                existing.description = details.get('description', '')
                import json
                existing.raw_metadata = json.dumps({
                    "status": details.get('status', ''),
                    "transaction": details.get('transaction', ''),
                    "posted_at": details.get('posted_at', ''),
                    "location": details.get('location', '')
                })
            self.db.commit()
            return existing

        import json
        new_prod = ScrapedProduct(
            specification_id=spec_id,
            platform=platform,
            external_id=item_data['external_id'],
            title=item_data['title'],
            description=details.get('description', ''),
            raw_metadata=json.dumps({
                "status": details.get('status', ''),
                "transaction": details.get('transaction', ''),
                "posted_at": details.get('posted_at', ''),
                "location": details.get('location', '')
            }) if details else None,
            price=price,
            url=item_data['url'],
            is_potential_profit=is_potential
        )
        self.db.add(new_prod)
        self.db.commit()
        self.db.refresh(new_prod)
        self.db.refresh(new_prod)
        
        return new_prod

    def validate_and_summarize_with_ai(self, product: ScrapedProduct, benchmark_price: float, profit_margin_percent: float):
        """
        Unified AI call: Stateless prompt that verifies product authenticity, hardware type, price range,
        and generates a clean summary with tags in standard JSON.
        """
        if not product.title: return None
        
        ollama_url = self.get_config("ollama_url", "http://localhost:11434/api/generate")
        model = self.get_config("ollama_model", "qwen3.5:4b")
        
        # Calculate allowed price range
        lower_bound = benchmark_price * 0.7   # Base price - 30%
        margin_mult = 1.0 + (profit_margin_percent / 100.0)
        upper_bound = benchmark_price * margin_mult

        # Get full specification name (Model + Spec)
        target_name = f"{product.specification.model.name} {product.specification.name}"

        prompt = f"""你是一個嚴格的二手 3C 商品鑑定處理器。
請根據以下資訊審核商品，輸出 JSON 格式。

【目標收購型號】
{target_name}

【待審核商品資訊】
標題：{product.title}
內文：{product.description[:1000]}
商品標價：{product.price:.0f} 元
收購基準價：{benchmark_price:.0f} 元（允許區間：{lower_bound:.0f} ~ {upper_bound:.0f}）

【審核規則】
1. 相符性：標題或內文是否明確指的是 "{target_name}"？(若型號不對或僅是配件則為 False)
2. 真實性：是否為「真實機器主機」？(若為空盒、保護殼、維修服務、無卡分期廣告、虛擬代碼則為 False)。註：若主機附帶盒子配件是加分項，不應誤判為空盒。
3. 價格：標價是否在允許區間內？(偏差過大可能是標錯價或釣魚廣告則為 False)
4. 狀態：是否為故障機、零件機、損壞、不亮、烙印、泡水？(若是則 is_faulty 為 True)

【輸出 JSON】
{{
  "is_valid": bool,
  "is_faulty": bool,
  "summary": "30字內重點摘要",
  "tags": ["標籤1", "標籤2"]
}}
"""
        import json
        try:
            response = requests.post(ollama_url, json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }, timeout=300)
            if response.status_code == 200:
                resp_json = response.json()
                print(f"DEBUG: Ollama Full Response: {resp_json}")
                result_text = resp_json.get("response", "").strip()
                
                # Use regex to find the first { and last } to extract JSON
                import re
                json_str = ""
                try:
                    # Look for { ... } including possible nested ones
                    json_match = re.search(r'(\{.*\})', result_text, re.DOTALL | re.MULTILINE)
                    if json_match:
                        json_str = json_match.group(1)
                        try:
                            data = json.loads(json_str)
                        except json.JSONDecodeError:
                            # Try to repair common LLM mistakes (single quotes instead of double)
                            repaired = json_str.replace("'", '"')
                            # Also handle trailing commas before closing braces
                            repaired = re.sub(r',\s*\}', '}', repaired)
                            repaired = re.sub(r',\s*\]', ']', repaired)
                            data = json.loads(repaired)
                    else:
                        data = json.loads(result_text)
                except Exception as je:
                    print(f"❌ CRITICAL AI PARSE ERROR: {je}")
                    print(f"RAW TEXT: {result_text}")
                    # Log snippet of raw text to product summary as placeholder for debugging
                    product.ai_summary = f"聯網鑑定失敗: AI 回傳格式不符。 (建議稍後點擊重試)"
                    self.db.commit()
                    return None
                
                # Case-insensitive and type-tolerant check for is_valid
                is_valid = data.get("is_valid")
                if isinstance(is_valid, str):
                    is_valid = is_valid.lower() == "true"
                elif is_valid is None:
                    is_valid = False
                if not is_valid:
                    product.is_potential_profit = False
                    product.ai_summary = f"AI 判定不符收購條件 (不推薦)"
                    self.db.commit()
                    return None
                    
                summary = data.get("summary", "")
                is_faulty = data.get("is_faulty", False)
                tags = data.get("tags", [])
                
                # Check summary text for faulty keywords just in case AI missed it
                if "故障" in summary or "壞" in summary or "漏液" in summary:
                    is_faulty = True
                    
                product.ai_summary = summary
                product.is_faulty = is_faulty
                product.is_potential_profit = True  # AI validated this as a real/valid item
                product.tags = ",".join(tags) if tags else ""
                
                self.db.commit()
                return summary
        except Exception as e:
            print(f"Ollama inference failed: {e}")
        return None

    def sweep_missing_details(self, limit: int = 5):
        """
        遍歷數據庫中高潛力項目，但缺失詳細描述的。
        從原始頁面抓取描述、具體狀況與地點，並更新標記。
        支援 Carousell 及 Yahoo Auction 平台。
        """
        from .carousell_scraper import CarousellScraper
        from .yahoo_scraper import YahooScraper
        items = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.is_potential_profit == True,
            ScrapedProduct.description == ""
        ).limit(limit).all()
        
        if not items: return 0
        
        carousell_scraper = CarousellScraper()
        yahoo_scraper = YahooScraper()
        count = 0
        for item in items:
            if item.platform == "Yahoo Auction":
                details = yahoo_scraper.get_item_details(item.url)
            else:
                details = carousell_scraper.get_item_details(item.url)
            if not details: continue
            
            item.description = details.get("description", "")
            # Handle JSON serialization for raw_metadata
            meta = {}
            if item.raw_metadata:
                try:
                    meta = json.loads(item.raw_metadata)
                    if not isinstance(meta, dict): meta = {}
                except: meta = {}

            meta.update({
                "status": details.get("status", ""),
                "transaction": details.get("transaction", ""),
                "posted_at": details.get("posted_at", ""),
                "location": details.get("location", "")
            })
            item.raw_metadata = json.dumps(meta)
            
            # Update tags based on new description
            tags_list = item.tags.split(",") if item.tags else []
            desc_text = item.description.lower()
            
            if "故障" in desc_text or "壞" in desc_text or "不開機" in desc_text:
                item.is_faulty = True
                if "故障機" not in tags_list: tags_list.append("故障機")
            
            if details.get("location"):
                location_tag = f"地點:{details['location']}"
                if location_tag not in tags_list:
                    tags_list.append(location_tag)

            item.tags = ",".join(list(set(tags_list))) # Deduplicate
            
            # AI Smart Validation: 驗證規格是否匹配
            if item.is_potential_profit:
                is_match = self.validate_spec_with_ai(item, item.specification)
                item.is_ai_validated = is_match
                if not is_match:
                    item.is_potential_profit = False
            
            self.db.commit()
            count += 1
            # Add small delay between detail fetches to be careful
            time.sleep(random.uniform(5, 10))
            
        return count

    def validate_spec_with_ai(self, product, spec) -> bool:
        """
        使用 Qwen 模型驗證商品是否真的符合目標規格。
        """
        ollama_url = self.get_config("ollama_url", "http://localhost:11434/api/generate")
        model = self.get_config("ollama_model", "qwen3.5:4b")
        
        prompt = f"""請判斷以下二手商品是否為 [目標規格] 所描述的產品。
[目標規格]：{spec.model.name} - {spec.name}

[賣家刊登內容]：
標題：{product.title}
描述：{product.description}

[判斷準則]：
1. 硬體規格（如 RAM, SSD, CPU 型號）必須完全符合或高於目標。
2. 排除僅販售「空盒」、「配件」、「零件機」、「損壞機」、「維修服務」或「代購」的刊登。
3. 排除型號明顯不符的（如：要把 MacBook Air 當 Pro 賣）。

請直接回答 [YES] 或 [NO]，並在後面加上一句話的理由。
回答格式：[結果] 理由
"""
        try:
            response = requests.post(ollama_url, json={
                "model": model,
                "prompt": prompt,
                "stream": False
            }, timeout=300)
            if response.status_code == 200:
                result = response.json().get("response", "").strip().upper()
                is_match = result.startswith("[YES]")
                print(f"AI Validation for {product.title}: {result}")
                return is_match
        except Exception as e:
            print(f"AI Validation failed: {e}")
        return True # Default to True on failure to avoid over-filtering

    def sweep_missing_summaries(self, limit: int = 5, check_abort=None):
        """
        Sweep through potential profit items missing summaries.
        Also re-validates against new filtering rules (keywords, price sanity).
        """
        items = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.ai_summary == None,
            ScrapedProduct.is_potential_profit == True
        ).limit(limit).all()
        
        count = 0
        for item in items:
            if check_abort and check_abort():
                print("🛑 AI Sweep Aborted by signal.")
                break
            spec = item.specification
            if not spec: continue

            # 1. Re-run Keyword Check
            category_name = spec.model.category.name if spec.model and spec.model.category else ""
            title_lower = item.title.lower()
            
            if category_name == "筆記型電腦" or "MacBook" in spec.model.name:
                spec_keywords = [k.strip().lower() for k in spec.name.replace('/', ' ').split() if len(k.strip()) > 1]
                if not all(k in title_lower for k in spec_keywords):
                    item.is_potential_profit = False
                    self.db.commit()
                    continue
            else:
                model_keywords = [k.strip().lower() for k in spec.model.name.split() if len(k.strip()) > 1]
                if not all(k in title_lower for k in model_keywords):
                    item.is_potential_profit = False
                    self.db.commit()
                    continue

            # 2. Re-run Price Sanity
            benchmarks = self.db.query(MarketPrice).filter(MarketPrice.specification_id == spec.id).all()
            manual_price = next((b.price for b in benchmarks if b.source == "Manual"), None)
            portal_prices = [b.price for b in benchmarks if b.source != "Manual"]
            portal_benchmark = max(portal_prices) if portal_prices else 0
            base_quote = manual_price if manual_price else portal_benchmark

            if base_quote > 0 and item.price < (base_quote * 0.3):
                item.is_potential_profit = False
                self.db.commit()
                continue

            # 3. All good, generate summary
            profit_percent_str = self.get_config(f"profit_margin", "30")
            if spec.model and spec.model.category:
                profit_percent_str = self.get_config(f"profit_margin_{spec.model.category.name}", "30")
            try:
                profit_margin_percent = float(profit_percent_str)
            except:
                profit_margin_percent = 30.0

            self.validate_and_summarize_with_ai(item, base_quote, profit_margin_percent)
            count += 1
        return count

    def record_stat(self, scanned=0, filtered=0, potential=0):
        from ..models import CrawlerStats
        today = datetime.now().date()
        # Find entry for today
        stat = self.db.query(CrawlerStats).filter(
            CrawlerStats.date >= datetime.combine(today, datetime.min.time()),
            CrawlerStats.date <= datetime.combine(today, datetime.max.time())
        ).first()
        
        if not stat:
            stat = CrawlerStats(
                date=datetime.now(),
                scanned_count=0,
                filtered_count=0,
                potential_count=0
            )
            self.db.add(stat)
            
        stat.scanned_count += scanned
        stat.filtered_count += filtered
        stat.potential_count += potential
        self.db.commit()

    def refresh_all_recommended_ai(self, check_abort=None):
        """Re-evaluates AI summaries for all currently recommended products"""
        products = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.is_ignored_by_user == False,
            ScrapedProduct.is_potential_profit == True
        ).all()

        count = 0
        for product in products:
            if check_abort and check_abort():
                print("🛑 Refresh ALL AI Aborted by signal.")
                break
            spec = product.specification
            if not spec: continue

            target_price = self.get_target_price(spec)
            if target_price <= 0: continue

            profit_percent_str = self.get_config("profit_margin", "30")
            if spec.model and spec.model.category:
                profit_percent_str = self.get_config(f"profit_margin_{spec.model.category.name}", "30")
            try:
                margin = float(profit_percent_str)
            except:
                margin = 30.0

            try:
                self.validate_and_summarize_with_ai(product, target_price, margin)
                count += 1
            except Exception as e:
                print(f"Failed to refresh AI for product {product.id}: {e}")
                
        return count
    def calculate_ai_predictions(self, check_abort=None):
        """AI-powered market predictions for tracked specifications"""
        from ..models import MarketPrediction, Specification
        from datetime import timedelta
        import json
        
        # Look back 30 days
        since = datetime.now() - timedelta(days=30)
        
        specs = self.db.query(Specification).filter(Specification.is_monitored == True).all()
        for spec in specs:
            if check_abort and check_abort():
                print("🛑 AI Prediction Aborted by signal.")
                break
            # Get non-faulty listings
            listings = self.db.query(ScrapedProduct.price).filter(
                ScrapedProduct.specification_id == spec.id,
                ScrapedProduct.is_faulty == False,
                ScrapedProduct.scraped_at >= since
            ).all()
            
            if not listings: continue
            
            prices = sorted([p[0] for p in listings])
            n = len(prices)
            median = prices[n//2] if n % 2 != 0 else (prices[n//2 - 1] + prices[n//2]) / 2
            
            # --- NEW: AI Auto-Pricer & Risk Analysis ---
            ollama_url = self.get_config("ollama_url", "http://localhost:11434/api/generate")
            model = self.get_config("ollama_model", "qwen3.5:4b")
            model_name = spec.model.name if spec.model else ""
            spec_name = spec.name
            
            prompt = f"""你是一個資深的 3C 產品市場分析師。
我們剛剛統整了近 30 天內二手 "{model_name} {spec_name}" 的市場行情。
一共取樣了 {n} 筆非故障的真實二手刊登，中位數價格為 {median} 元。
市場最低價為 {prices[0]} 元，最高價為 {prices[-1]} 元。

請根據這些數據與你對此機型的知識，以 JSON 格式進行分析，必須包含以下四個欄位：
- "suggested_buy_price": 數字 (建議收購價，低於中位數保留合理利潤空間)
- "suggested_sell_price": 數字 (建議轉售價，約等於中位數)
- "market_demand": 字串 (評估市場熱門度：例如 "極高" 或 "中等")
- "risk_assessment": 字串 (跌價風險：例如 "保值" 或 "將有新機發表跌價風險高")

請只輸出純 JSON，不要包含任何 markdown 或其他說明的廢話："""

            ai_analysis_str = None
            try:
                response = requests.post(ollama_url, json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }, timeout=300)
                if response.status_code == 200:
                    ai_res = response.json().get("response", "").strip()
                    if "```json" in ai_res:
                        ai_res = ai_res.split("```json")[1].split("```")[0].strip()
                    elif "```" in ai_res:
                        ai_res = ai_res.split("```")[1].strip()
                    ai_analysis_str = ai_res
            except Exception as e:
                print(f"AI Pricing inference failed: {e}")

            prediction = self.db.query(MarketPrediction).filter(
                MarketPrediction.specification_id == spec.id
            ).first()
            
            if prediction:
                prediction.predicted_price = median
                prediction.sample_size = len(prices)
                if ai_analysis_str:
                    prediction.ai_analysis = ai_analysis_str
                prediction.updated_at = datetime.now()
            else:
                prediction = MarketPrediction(
                    specification_id=spec.id,
                    predicted_price=median,
                    sample_size=len(prices),
                    ai_analysis=ai_analysis_str
                )
                self.db.add(prediction)
        
        self.db.commit()
