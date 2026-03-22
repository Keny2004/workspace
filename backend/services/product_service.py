from sqlalchemy.orm import Session
from datetime import datetime
from ..models import ScrapedProduct, MarketPrice, Specification, SystemConfig
import requests
from ..config_utils import get_config_value

class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def get_config(self, key: str, default: str = None) -> str:
        return get_config_value(key, default)

    def process_scraped_item(self, spec_id: int, platform: str, item_data: dict):
        spec = self.db.query(Specification).filter(Specification.id == spec_id).first()
        if not spec: return

        # 1. Get All Portal Benchmarks (Benchmark A)
        benchmarks = self.db.query(MarketPrice).filter(
            MarketPrice.specification_id == spec_id
        ).order_by(MarketPrice.updated_at.desc()).all()

        # 2. Get Real-World Listing Median (Benchmark B)
        # Fetching latest 50 listings to get a sense of "current" market listings
        listing_prices = [p.price for p in self.db.query(ScrapedProduct.price).filter(
            ScrapedProduct.specification_id == spec_id
        ).order_by(ScrapedProduct.scraped_at.desc()).limit(50).all()]
        
        listing_median = 0
        if listing_prices:
            sorted_prices = sorted(listing_prices)
            n = len(sorted_prices)
            listing_median = sorted_prices[n//2] if n % 2 != 0 else (sorted_prices[n//2 - 1] + sorted_prices[n//2]) / 2

        # 3. Define True Market Price
        portal_benchmark = 0
        if benchmarks:
            seen_sources = set()
            latest_benchmarks = []
            for b in benchmarks:
                if b.source not in seen_sources:
                    seen_sources.add(b.source)
                    latest_benchmarks.append(b)
            portal_benchmark = max(b.price for b in latest_benchmarks)
        
        # True market price is the higher of professional benchmarks or real-world medians
        # This prevents recommending items just because a portal has an outdated low price.
        true_market_price = max(portal_benchmark, listing_median)
        
        if true_market_price <= 0:
            return # Cannot evaluate without any data

        price = item_data['price']
        
        # 4. Get Category-Specific Margin
        cat_name = spec.model.category.name if spec.model and spec.model.category else ""
        margin_key = f"profit_margin_{cat_name}"
        profit_margin_str = self.get_config(margin_key, self.get_config("profit_margin", "5"))
        
        try:
            profit_margin = float(profit_margin_str) / 100.0
        except:
            profit_margin = 0.05

        # Evaluation Logic:
        # 1. Too cheap: price < true_market_price * 0.7 -> Likely scam or parts-only
        if price < true_market_price * 0.7:
            is_potential = False
        # 2. Potential Profit: price < true_market_price * (1 - profit_margin)? 
        # Actually user wants "profit margin" to mean "I want to buy at X% lower than market"
        # The previous logic was price < benchmark * (1 + margin) which seems like "sell price > buy price + margin"
        # Let's stick to the user's intent: Buy price should be significantly below market price.
        elif price < true_market_price * (1 - profit_margin):
            is_potential = True
        else:
            is_potential = False

        # 5. Save/Update
        existing = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.external_id == item_data['external_id'],
            ScrapedProduct.platform == platform
        ).first()

        if existing:
            existing.price = price
            existing.is_potential_profit = is_potential
            self.db.commit()
            return existing

        new_prod = ScrapedProduct(
            specification_id=spec_id,
            platform=platform,
            external_id=item_data['external_id'],
            title=item_data['title'],
            description=item_data['description'],
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
        Call Ollama API for summarization.
        Prompt: 繁體中文，30字以內，「機況是否正常、有無維修紀錄、電池健康度、配件狀況」
        """
        ollama_url = self.get_config("ollama_url", "http://localhost:11434/api/generate")
        model = self.get_config("ollama_model", "gemma3:1b") # User specified gemma 3: 1b if available

        prompt = f"""請以繁體中文，用 30 字以內總結以下二手 3C 商品的資訊。
內容需包含：「機況是否正常、有無維修紀錄、電池健康度、配件狀況」。

標題：{product.title}
描述：{product.description}
"""
        try:
            response = requests.post(ollama_url, json={
                "model": model,
                "prompt": prompt,
                "stream": False
            }, timeout=30)
            if response.status_code == 200:
                summary = response.json().get("response", "").strip()
                product.ai_summary = summary
                self.db.commit()
                return summary
        except Exception as e:
            print(f"Ollama inference failed: {e}")
        return None
