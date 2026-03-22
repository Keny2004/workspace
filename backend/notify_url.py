import time
import re
import os
import requests
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import SystemConfig

def get_config(db, key, default=None):
    conf = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    return conf.value if conf else default

def send_telegram(token, user_id, message):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": user_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Failed to send Telegram: {e}")

def monitor_tunnel(log_path):
    print(f"Monitoring {log_path} for Cloudflare URL...")
    url_pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    
    # Try for up to 2 minutes
    start_time = time.time()
    while time.time() - start_time < 120:
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                content = f.read()
                match = url_pattern.search(content)
                if match:
                    live_url = match.group(0)
                    print(f"Detected live URL: {live_url}")
                    return live_url
        time.sleep(2)
    return None

def main():
    log_path = "tunnel.log"
    live_url = monitor_tunnel(log_path)
    
    if live_url:
        db = SessionLocal()
        try:
            token = get_config(db, "telegram_token")
            user_id = get_config(db, "telegram_user_id")
            
            if token and user_id:
                msg = f"🚀 *Neural_Link Online*\n\n系統已成功部署至 Cloudflare。\n\n🔗 [點擊進入系統]({live_url})\n\n_Time: {time.strftime('%Y-%m-%d %H:%M:%S')}_"
                send_telegram(token, user_id, msg)
                print("Notification sent!")
            else:
                print("Missing Telegram config.")
        finally:
            db.close()
    else:
        print("Timeout waiting for tunnel URL.")

if __name__ == "__main__":
    main()
