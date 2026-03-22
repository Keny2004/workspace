import requests
import os
from dotenv import load_dotenv

load_dotenv()

from ..config_utils import get_config_value

class TelegramService:
    def __init__(self):
        self.token = get_config_value("telegram_token")
        self.user_id = get_config_value("telegram_user_id")
        self.base_url = f"https://api.telegram.org/bot{self.token}/sendMessage" if self.token else None

    def send_notification(self, message: str):
        if not self.token or not self.user_id:
            # Re-fetch in case config was updated
            self.token = get_config_value("telegram_token")
            self.user_id = get_config_value("telegram_user_id")
            self.base_url = f"https://api.telegram.org/bot{self.token}/sendMessage" if self.token else None

        if not self.token or not self.user_id:
            print("Telegram credentials NOT set.")
            return

        payload = {
            "chat_id": self.user_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        try:
            response = requests.post(self.base_url, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to send Telegram notification: {e}")
            return None

    def format_product_message(self, product, spec_name, profit):
        """
        格式：「商品名稱、售價、預估獲利、AI機況總結、Cloudflare Tunnel 網站連結、商品原連結」
        """
        # Note: Cloudflare Tunnel link would be set in config/env
        base_app_url = os.getenv("APP_URL", "http://your-tunnel-url.com")
        
        msg = f"🚀 *發現獲利商品！*\n\n"
        msg += f"*名稱*: {product.title} ({spec_name})\n"
        msg += f"*售價*: NT${product.price:,.0f}\n"
        msg += f"*預估獲利*: NT${profit:,.0f}\n\n"
        msg += f"*AI 總結*: {product.ai_summary or '分析中...'}\n\n"
        msg += f"🔗 [查看詳情]({base_app_url}/recommendations)\n"
        msg += f"🛒 [原始連結]({product.url})"
        return msg
