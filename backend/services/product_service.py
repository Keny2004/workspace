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
        # 1. Get Benchmark Price
        benchmark = self.db.query(MarketPrice).filter(
            MarketPrice.specification_id == spec_id
        ).order_by(MarketPrice.updated_at.desc()).first()

        if not benchmark:
            return # Cannot evaluate without benchmark

        price = item_data['price']
        benchmark_price = benchmark.price
        
        # Get profit margin from config (e.g., 5%)
        profit_margin_str = self.get_config("profit_margin", "5")
        try:
            profit_margin = float(profit_margin_str) / 100.0
        except:
            profit_margin = 0.05

        # Pricing Logic:
        # 1. Too cheap: price < benchmark * 0.8 ->零件機/異常 (Skip)
        if price < benchmark_price * 0.8:
            return

        # 2. Potential Profit: benchmark * 0.8 <= price < benchmark * (1 + margin)
        is_potential = False
        if price < benchmark_price * (1 + profit_margin):
            is_potential = True

        # 3. Check if already exists by external_id
        existing = self.db.query(ScrapedProduct).filter(
            ScrapedProduct.external_id == item_data['external_id'],
            ScrapedProduct.platform == platform
        ).first()

        if existing:
            # Update price and basic info if needed
            existing.price = price
            existing.is_potential_profit = is_potential
            self.db.commit()
            return existing

        # 4. Save new product
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
