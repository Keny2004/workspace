#!/bin/bash

# 切換到專案目錄
cd "$(dirname "$0")"

echo "==========================================="
echo "啟動 AI 智慧套利全端環境與公網隧道"
echo "==========================================="

# 確保虛擬環境存在
if [ ! -d "venv" ]; then
    echo "安裝虛擬環境中..."
    python3 -m venv venv
fi

# 啟動虛擬環境並安裝依賴
source venv/bin/activate
echo "檢查/更新依賴套件中..."
pip install -r requirements.txt -q

# 檢查是否安裝了 cloudflared (Mac OS)
if ! command -v cloudflared &> /dev/null
then
    echo "❌ 找不到 Cloudflare Tunnels (cloudflared)。"
    echo "若是 Mac 用戶，請開啟新終端機輸入: brew install cloudflared"
    echo "程式將會在沒有公網隧道的情況下繼續本地執行。"
    HAS_CF=0
else
    HAS_CF=1
fi

echo "==========================================="

# 定義關閉清理涵式
cleanup() {
    echo ""
    echo "收到終止訊號！正在關閉所有背景服務..."
    kill $PYTHON_PID 2>/dev/null
    kill $OLLAMA_PID 2>/dev/null
    if [ "$HAS_CF" -eq 1 ]; then
        kill $CF_PID 2>/dev/null
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. 啟動 Ollama 大模型伺服器
echo "🖥️ 啟動 Ollama 伺服器 (背景)..."
ollama serve > /dev/null 2>&1 &
OLLAMA_PID=$!

sleep 2 # 給 ollama 一點啟動時間

# 2. 啟動 Python 後端 (FastAPI + 排程器)
echo "🐍 啟動 FastAPI 後端與推播爬蟲 (背景，帶自動重啟)..."
(
    while true; do
        python3 main.py
        echo "$(date) - 偵測到程式崩潰或結束，將在 2 秒後重新啟動..."
        sleep 2
    done
) &
PYTHON_PID=$!

sleep 3 # 給 uvicorn 一點啟動時間

# 3. 啟動 Cloudflare Tunnels (若有安裝)
if [ "$HAS_CF" -eq 1 ]; then
    echo "☁️ 啟動 Cloudflare Tunnels 隧道..."
    CF_LOG="cloudflared.log"
    rm -f $CF_LOG
    cloudflared tunnel --url http://localhost:8000 > $CF_LOG 2>&1 &
    CF_PID=$!
    
    # 調用 python 腳本推播網址給 Telegram
    python3 send_cf_url.py $CF_LOG
else
    echo "ℹ️ 您可以使用 http://localhost:8000 讀取儀表板"
fi

echo "==========================================="
echo "✨ 所有服務均已啟動完畢！"
echo "請按 [Ctrl + C] 一鍵關閉所有服務。"
echo "==========================================="

# 懸掛主程序的終端機，等待 Ctrl+C
wait
