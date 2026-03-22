#!/bin/bash

echo "🚀 正在啟動 Carousell 監控機器人與儀表板..."

# 切換到專案目錄
cd "$(dirname "$0")"

# 確保虛擬環境存在
if [ ! -d "venv" ]; then
    echo "安裝虛擬環境中..."
    python3 -m venv venv
fi

# 啟動虛擬環境並安裝依賴（以防萬一）
source venv/bin/activate
echo "檢查/更新依賴套件中..."
pip install -r requirements.txt -q

# 啟動主程式
echo "啟動完成！您可以透過瀏覽器查看: http://localhost:8000"
echo "若要停止程式請按下 Ctrl + C"
python3 main.py
