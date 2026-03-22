import logging
import requests
from typing import Dict, Any

logger = logging.getLogger(__name__)

def send_telegram_message(config: Dict[str, Any], item: Dict[str, Any]) -> bool:
    telegram_config = config.get("telegram", {})
    bot_token = telegram_config.get("bot_token")
    chat_id = telegram_config.get("chat_id")
    
    if not bot_token or not chat_id:
        logger.warning("Telegram token or chat_id is missing. Not sending notification: %s", item.get('title'))
        return False
        
    status = item.get("status", "Normal Deal")
    if status == "Great Deal":
        flag = "🔥"
        header = f"{flag} **[Great Deal] 發現低於市價的好物！**"
    elif status == "Special":
        flag = "⚠️"
        header = f"{flag} **[Special] 發現低價微瑕疵商品，值得考慮！**"
    else:
        flag = "🔵"
        header = f"{flag} **發現新商品**"
        
    message = (
        f"{header}\n\n"
        f"🏷️ 商品名稱：{item.get('title')}\n"
        f"💰 售價：NT$ {item.get('price')}\n"
        f"⏱️ 上架時間：{item.get('time')}\n\n"
        f"🔗 連結：\n{item.get('url')}"
    )
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "disable_web_page_preview": False
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(f"Telegram notification sent for item: {item.get('id')} ({status})")
        return True
    except Exception as e:
        logger.error(f"Failed to send Telegram message for item {item.get('id')}: {e}")
        return False
