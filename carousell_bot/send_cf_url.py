import time
import re
import sys
import yaml
from notifier import send_telegram_system_message

def main():
    if len(sys.argv) < 2:
        print("未提供日誌文件路徑！")
        sys.exit(1)
        
    log_file = sys.argv[1]
    config_file = "config.yaml"
    
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"讀取 config.yaml 失敗: {e}")
        return
        
    print("⏳ 等待 Cloudflare 生成隨機公網網址...")
    
    for _ in range(30):
        time.sleep(2)
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                content = f.read()
                matches = re.findall(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', content)
                if matches:
                    url = matches[-1]
                    msg = f"🚀 <b>Carousell AI 儀表板已上線！</b>\n\n💡 您的專屬公網控制台網址為：\n{url}\n\n<i>(這是安全加密隧道，任何人得知網址皆可瀏覽，請妥善保管)</i>"
                    if send_telegram_system_message(config, msg):
                        print(f"✅ 成功攔截並推播網址至 Telegram: {url}")
                    else:
                        print(f"⚠️ 攔截到網址 {url}，但 Telegram 推播失敗 (請檢查 config.yaml 的 Token)")
                    return
        except FileNotFoundError:
            continue
            
    print("❌ 超時未取得 Cloudflare 網址。")

if __name__ == "__main__":
    main()
