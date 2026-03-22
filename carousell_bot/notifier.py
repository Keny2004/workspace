import requests
import logging

logger = logging.getLogger(__name__)

def send_telegram_message(config, item):
    """
    透過 Telegram Bot API 發送商品通知 (繁體中文介面)
    """
    token = config.get("telegram", {}).get("bot_token")
    chat_id = config.get("telegram", {}).get("chat_id")
    
    if not token or not chat_id:
        logger.warning(f"Telegram token 或 chat_id 未設定。略過推播: {item['title']}")
        return False
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    
    status_emoji = "🔥" if item.get("status") == "Great Deal" else "⚠️"
    
    # Check if it's a parts machine based on AI reason or status
    if item.get("status") == "Parts Machine" or "零件" in item.get("status", ""):
        status_emoji = "🛠️"
        
    status_display = {
        "Great Deal": "推薦優惠 (AI 認證)",
        "Special": "微瑕疵/特殊",
        "Parts Machine": "零件/故障機"
    }.get(item.get("status"), item.get("status"))
    
    message = f"""{status_emoji} <b>發現新套利目標！</b> {status_emoji}

📌 <b>標題:</b> {item.get('title')}
💰 <b>價格:</b> NT$ {item.get('price')}
🏷️ <b>分類狀態:</b> {status_display}
⏰ <b>發布時間:</b> {item.get('time')}

🔗 <a href="{item.get('url')}">點此前往旋轉拍賣</a>
"""
    
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": False
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(f"Telegram 推播成功: {item['title']}")
        return True
    except Exception as e:
        logger.error(f"Telegram 推播失敗: {e}")
        return False

def send_telegram_system_message(config, message: str):
    """
    發送系統狀態通知 (如 Cloudflare 網址)
    """
    token = config.get("telegram", {}).get("bot_token")
    chat_id = config.get("telegram", {}).get("chat_id")
    
    if not token or not chat_id:
        return False
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
    }
    try:
        requests.post(url, json=payload, timeout=10)
        return True
    except:
        return False
