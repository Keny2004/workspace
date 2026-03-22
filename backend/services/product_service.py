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

        # 5. Save/Update
        existing = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.external_id == item_data['external_id'],
            ScrapedProduct.platform == platform
        ).first()

        # If it's a new potential hit, OR an existing potential hit without description, fetch details
        should_fetch_details = is_potential and (not existing or not existing.description)
        details = {}
        if should_fetch_details:
            from .carousell_scraper import CarousellScraper
            if platform == "Carousell":
                scraper = CarousellScraper()
                details = scraper.get_item_details(item_data['url'])
                
            # --- NEW: Anomaly Detection ---
            if self.detect_anomaly_with_ai(item_data['title'], details.get('description', '')):
                is_potential = False
                
        if is_potential:
            self.record_stat(potential=1)
        else:
            self.record_stat(filtered=1)

        if existing:
            existing.price = price
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
        
        return new_prod

    def generate_ai_summary(self, product: ScrapedProduct):
        """
        Call Ollama API for summarization. Focus on DETAILS, < 50 words.
        """
        ollama_url = self.get_config("ollama_url", "http://localhost:11434/api/generate")
        model = self.get_config("ollama_model", "qwen3.5:4b")

        prompt = f"""請以繁體中文分析以下二手商品賣家描述，給出極簡總結與關鍵標籤。
直接轉述重點細節，絕不可包含任何客服專線、實體門市地址、營業時間或無關的客套話。
1. 瑕疵/傷痕/漏液 具體位置
2. 電池健康度/循環次數 (若有)
3. 是否維修過
4. 配件有無

[格式規範]：
總結開頭必須標示狀態：若有故障/損壞/螢幕問題必須標為 [⚠️故障機]，若一切正常標為 [✅正常]。
總結請控制在 30 字以內，一目了然。
重點標籤請擷取3-5個，以逗號分隔（例如：螢幕漏液, 故障機, 未維修, 單機無配件）。

請嚴格依照以下格式輸出：
【總結】: [狀態] 你的總結...
【標籤】: 標籤1, 標籤2, 標籤3

標題：{product.title}
描述：{product.description}
"""
        try:
            response = requests.post(ollama_url, json={
                "model": model,
                "prompt": prompt,
                "stream": False
            }, timeout=300)
            if response.status_code == 200:
                result_text = response.json().get("response", "").strip()
                
                # Parse summary and tags
                summary = result_text
                tags_str = ""
                
                import re
                summary_match = re.search(r'【總結】[:：]?\s*(.*)', result_text)
                tags_match = re.search(r'【標籤】[:：]?\s*(.*)', result_text)
                
                if summary_match:
                    summary = summary_match.group(1).strip()
                if tags_match:
                    tags_str = tags_match.group(1).strip()
                
                product.ai_summary = summary
                
                if "[⚠️故障機]" in summary or "故障" in summary or "壞" in summary or "漏液" in summary:
                    product.is_faulty = True
                else:
                    product.is_faulty = False
                
                if tags_str:
                    tags_str = re.sub(r'[\.。\"\']$', '', tags_str)
                    new_tags = [t.strip() for t in tags_str.split(',') if t.strip()]
                    product.tags = ",".join(new_tags)
                elif product.is_faulty:
                    product.tags = "故障"
                    
                self.db.commit()
                return summary
        except Exception as e:
            print(f"Ollama inference failed: {e}")
        return None

    def detect_anomaly_with_ai(self, title: str, description: str) -> bool:
        """
        Use AI to quickly determine if a listing is a fake product, an empty box, 
        an installment (分期/貸款) ad, or an accessory instead of the main target.
        """
        if not title: return False
        
        ollama_url = self.get_config("ollama_url", "http://localhost:11434/api/generate")
        model = self.get_config("ollama_model", "qwen3.5:4b")

        prompt = f"""請判斷以下拍賣商品是否為「真實的3C主機/設備買賣」。
若是以下任何一種情況，請直接回答 "ANOMALY"，否則回答 "NORMAL"：
1. 僅販售「空盒」、「外盒」或「包裝」。
2. 這是「無卡分期」、「貸款」、「免卡分期」的廣告或報價。
3. 僅販售「手機殼」、「保護貼」、「充電線」、「手寫筆」等周邊配件。
4. 這是「高價收購」、「維修服務」的廣告，而非賣商品。
5. 標題與內文只寫了「零件機」、「屍體機」等嚴重毀損無法使用的機器。

只允許回答 "ANOMALY" 或 "NORMAL"，不要有任何其他文字。

商品標題：{title}
商品描述：{description}
"""
        try:
            response = requests.post(ollama_url, json={
                "model": model,
                "prompt": prompt,
                "stream": False
            }, timeout=300)
            if response.status_code == 200:
                result_text = response.json().get("response", "").strip().upper()
                if "ANOMALY" in result_text:
                    return True
        except Exception as e:
            print(f"Anomaly detection failed: {e}")
            
        return False

    def sweep_missing_details(self, limit: int = 5):
        """
        遍歷數據庫中高潛力項目，但缺失詳細描述的。
        從原始頁面抓取描述、具體狀況與地點，並更新標記。
        """
        from .carousell_scraper import CarousellScraper
        items = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.is_potential_profit == True,
            ScrapedProduct.description == ""
        ).limit(limit).all()
        
        if not items: return 0
        
        scraper = CarousellScraper()
        count = 0
        for item in items:
            details = scraper.get_item_details(item.url)
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

    def sweep_missing_summaries(self, limit: int = 5):
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
            self.generate_ai_summary(item)
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

    def calculate_ai_predictions(self):
        """
        Hourly task: Calculate median price of non-faulty listings for all monitored specs.
        """
        from ..models import MarketPrediction
        from datetime import timedelta
        import json
        
        # Look back 30 days
        since = datetime.now() - timedelta(days=30)
        
        specs = self.db.query(Specification).filter(Specification.is_monitored == True).all()
        for spec in specs:
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
                    ai_analysis_str = response.json().get("response", "").strip()
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
