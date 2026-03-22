import time
import threading
import logging
import yaml
import schedule
import uvicorn
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import requests

import database
import scraper
import analyzer
import notifier
import ai_evaluator

# === 1. WebSocket 管理器 ===
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        text_data = json.dumps(message, ensure_ascii=False)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(text_data)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()
loop_ref = None

# === 2. 隊列日誌系統 ===
log_queue = asyncio.Queue()

class WsLogHandler(logging.Handler):
    def emit(self, record):
        log_entry = self.format(record)
        if loop_ref is not None:
            loop_ref.call_soon_threadsafe(log_queue.put_nowait, log_entry)

async def log_publisher():
    """ 背景任務：從隊列讀取日誌並透過 WebSocket 廣播 """
    while True:
        log_msg = await log_queue.get()
        if manager.active_connections:
            await manager.broadcast({"type": "log", "message": log_msg})
        log_queue.task_done()

# === 3. 初始化工作 ===
def load_config():
    try:
        with open("config.yaml", "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {"analysis": {}, "telegram": {}, "trading": {}}

def load_targets():
    try:
        with open("targets.yaml", "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if isinstance(data, list):
                return data
            return data.get("targets", []) if data else []
    except Exception as e:
        logger.error(f"讀取 targets.yaml 失敗: {e}")
        return []

config = load_config()
targets_list = load_targets()

# === 4. FastAPI 實作 ===
app = FastAPI(title="Carousell AI 究極套利儀表板")
app.mount("/static", StaticFiles(directory="web"), name="static")

@app.on_event("startup")
async def startup_event():
    global loop_ref
    loop_ref = asyncio.get_running_loop()
    
    # 啟動日誌廣播與資料庫初始化
    asyncio.create_task(log_publisher())
    logger.info("系統啟動：正在初始化資料庫與背景任務...")
    database.init_db()
    
    # 啟動排程執行緒
    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()

# 設定全域日誌記錄器
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ws_handler = WsLogHandler()
ws_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logging.getLogger().addHandler(ws_handler) # Root logger
for name in ["scraper", "analyzer", "database", "ai_evaluator"]:
    logging.getLogger(name).addHandler(ws_handler)
    logging.getLogger(name).setLevel(logging.INFO)

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("web/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # 送出初次連線的市價統計
    await send_market_stats()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/system_status")
async def get_system_status():
    """傳回系統運行狀態與資料庫統計"""
    return {
        "stats": global_stats,
        "db_size_mb": round(database.get_db_size() / (1024 * 1024), 2),
        "db_rows": database.get_row_counts(),
        "uptime_start": app.state.start_time if hasattr(app.state, "start_time") else None
    }
@app.get("/api/deals")
async def get_profitable_deals(limit: int = 50, target: str = None, spec: str = None, category: str = None, include_read: bool = False):
    deals = database.get_profitable_deals(limit=limit, target_name=target, specification=spec, category=category, include_read=include_read)
    return {"status": "success", "data": deals}

@app.get("/api/market")
async def get_items(limit: int = 50, status: str = None, target: str = None, spec: str = None, category: str = None, include_read: bool = False):
    items = database.get_items(limit=limit, status=status, target_name=target, specification=spec, category=category, include_read=include_read)
    return {"status": "success", "data": items}

@app.get("/api/parts")
async def get_parts(target: str = None, include_read: bool = False, spec: str = None, category: str = None):
    parts = database.get_parts_deals(target_name=target, include_read=include_read, specification=spec, category=category)
    return {"status": "success", "data": parts}

@app.post("/api/mark_read")
async def mark_read(request: Request):
    data = await request.json()
    table = data.get("table")
    item_id = data.get("id")
    is_read = 1 if data.get("is_read") else 0
    if database.toggle_is_read(table, item_id, is_read):
        return {"status": "success"}
    return {"status": "error", "message": "Failed to update read status"}

@app.post("/api/clear_db")
async def clear_db():
    if database.clear_items():
        return {"status": "success"}
    return {"status": "error", "message": "Failed to clear database"}

@app.post("/api/clear_market_stats")
async def clear_market_stats():
    if database.clear_market_stats():
        return {"status": "success"}
    return {"status": "error", "message": "Failed to clear market stats"}

@app.post("/api/delete_item")
async def delete_item(request: Request):
    data = await request.json()
    item_id = data.get("id")
    if database.delete_specific_item(item_id):
        return {"status": "success"}
    return {"status": "error", "message": "Failed to delete item"}

# 全域統計數據 (啟動時從資料庫載入)
global_stats = {
    "scraped": 0,
    "ignored": 0,
    "saved": 0,
    "deals": 0
}

def load_initial_stats():
    global global_stats
    db_stats = database.get_cumulative_stats()
    if db_stats:
        global_stats["scraped"] = db_stats.get("total_scraped", 0)
        global_stats["ignored"] = db_stats.get("total_ignored", 0)
        global_stats["saved"] = db_stats.get("total_saved", 0)
        global_stats["deals"] = db_stats.get("total_deals", 0)
    logger.info(f"已從資料庫載入累計統計: {global_stats}")

load_initial_stats()

@app.get("/api/targets")
async def get_targets(category: str = None):
    targets = load_targets()
    if category:
        targets = [t for t in targets if t.get("category") == category]
    return {"status": "success", "data": targets}

@app.get("/api/system_stats")
async def get_system_stats(category: str = None):
    targets = load_targets()
    if category:
        targets = [t for t in targets if t.get("category") == category]
    
    cumulative = database.get_cumulative_stats()
    return {"status": "success", "targets": targets, "stats": cumulative}

@app.get("/api/market_stats")
async def get_market_stats(target: str = None):
    stats = database.get_market_price_stats(target_name=target)
    return {"status": "success", "data": stats}

@app.post("/api/save_config")
async def save_config(request: Request):
    """ 儲存交易偏好設定 """
    try:
        data = await request.json()
        trading = data.get("trading")
        if not trading:
            return {"status": "error", "message": "缺少交易偏好數據"}
            
        # 讀取現有 config
        with open("config.yaml", "r", encoding="utf-8") as f:
            full_config = yaml.safe_load(f) or {}
            
        full_config["trading"] = trading
        
        # 寫回
        with open("config.yaml", "w", encoding="utf-8") as f:
            yaml.safe_dump(full_config, f, allow_unicode=True)
            
        # 即時更新記憶體中的 config (如果是全域變數)
        global config
        config = full_config
        
        return {"status": "success", "message": "偏好設定已更新至 config.yaml"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/generate_target")
async def generate_target(request: Request):
    """
    透過本地 Ollama 自動判斷意圖 (新增或刪除) 並執行對應配置
    """
    global targets_list
    data = await request.json()
    user_text = data.get("product_name")
    if not user_text:
        return JSONResponse({"status": "error", "message": "請提供商品名稱或對話指令"}, status_code=400)
        
    current_names = [t.get('name') for t in targets_list]
    
    # 1. 意圖識別
    intent_prompt = f"""請判斷使用者的指令意圖是「新增商品」還是「刪除/停止監控商品」。
目前系統中正在監控的清單：{', '.join(current_names) if current_names else '無'}

這是一個嚴格的 JSON 轉換任務，請直接輸出 JSON，不可有多餘文字：
【範例1】使用者輸入：「Apple Watch S8」 (單純寫名字代表想新增)
回傳：{{"intent": "add", "product": "Apple Watch S8"}}
【範例2】使用者輸入：「幫我把 iPhone 14 Pro 刪掉」
回傳：{{"intent": "delete", "target": "iPhone 14 Pro"}}

【現在請處理】
使用者輸入：「{user_text}」
回傳：
"""
    try:
        ollama_url = getattr(ai_evaluator, "OLLAMA_URL", "http://localhost:11434/api/generate")
        model = getattr(ai_evaluator, "DEFAULT_MODEL", "gemma3:1b")
        
        # 呼叫 Ollama 分析意圖
        intent_res = requests.post(ollama_url, json={"model": model, "prompt": intent_prompt, "stream": False, "format": "json"}, timeout=30)
        intent_res.raise_for_status()
        
        result_text = intent_res.json().get("response", "").strip()
        try:
            intent_data = json.loads(result_text)
        except json.JSONDecodeError:
            intent_data = {"intent": "add", "product": user_text} # Fallback
            
        intent = intent_data.get("intent", "add")
        
        if intent == "delete":
            target_to_delete = intent_data.get("target")
            if not target_to_delete or target_to_delete not in current_names:
                return {"status": "error", "message": f"AI 判斷您想刪除商品，但在監控清單中找不到名稱為【{target_to_delete}】的目標。請確認您輸入得更精確一點。"}
            
            return {
                "status": "confirm_delete",
                "message": f"🤖 AI 識別意圖：您想要刪除【{target_to_delete}】。\n\n請問是否確定要終止這項商品的追蹤？",
                "target_name": target_to_delete
            }
            
        product_name = intent_data.get("product", user_text)
        logger.info(f"AI 啟動目標建立程序: {product_name}")
        
        prompt = f"""你是二手機平台設定專家。目標：在旋轉拍賣監控「{product_name}」。

請為此商品生成一個 YAML 配置。
⚠️ 絕對禁止：不可將商品名稱中的關鍵字放入 excluded_keywords (例如找耳機時，不可排除「耳機」)。
⚠️ 專業判斷：如果商品是耳機，市價可能是 $5000-$8000；如果是相機，可能是 $30000+。請根據常識給出合理市價。
⚠️ 規格細分：請務必區分 Pro, Pro Max, Plus 等變體。如果使用者沒指定，優先建立最基礎或最熱門的型號名稱（例如 iPhone 15 Pro），並在 required_keywords 寫入該型號。

【輸出範例】以 Sony A7C 為例：
- name: "Sony A7C"
  keyword: "Sony A7C"
  sort_by: 3
  delay_range: [3, 8]
  market_price_estimate: 35000
  required_keywords:
    - "A7C"
  excluded_keywords:
    - "單賣空盒"
    - "模型"
    - "交換"

【現在請為「{product_name}」產生一個最契合的專業監控目標 YAML】：
"""
        res = requests.post(ollama_url, json={"model": model, "prompt": prompt, "stream": False}, timeout=60)
        yaml_text = res.json().get("response", "").strip()
        yaml_text = yaml_text.replace("```yaml", "").replace("```", "").strip()
        
        # 嚴謹地解析並寫入設定檔，避免破壞結構
        try:
            new_target_dict = yaml.safe_load(yaml_text)
            if isinstance(new_target_dict, list):
                new_target_dict = new_target_dict[0]
            elif isinstance(new_target_dict, dict) and "targets" in new_target_dict:
                new_target_dict = new_target_dict["targets"][0]
        except Exception:
            return JSONResponse({"status": "error", "message": "AI 產生的格式損壞，無法載入。請重試。"})
            
        with open("targets.yaml", "r", encoding="utf-8") as f:
            config_data = yaml.safe_load(f)
            
        if "targets" not in config_data or not isinstance(config_data["targets"], list):
            config_data["targets"] = []
            
        # 防止重複添加
        if not any(t.get("name") == new_target_dict.get("name") for t in config_data["targets"]):
            config_data["targets"].append(new_target_dict)
            
            with open("targets.yaml", "w", encoding="utf-8") as f:
                f.write("# 目標商品清單\n# 請在這裡定義您想要監控的商品。\n\n")
                yaml.dump(config_data, f, allow_unicode=True, sort_keys=False)
            
        # 立刻重新載入以生效
        global global_stats
        targets_list = load_targets()
        new_name = new_target_dict.get("name")
        if new_name:
            global_stats[new_name] = {"scraped": 0, "ignored": 0, "saved": 0}
        
        # 抓取剛建立的最新目標，並將其放到背景立刻爬取一次！
        new_target = targets_list[-1]
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, lambda: process_target(new_target))
        
        return {"status": "success", "message": f"成功新增配置【{new_target.get('name')}】！已在背景為您立刻啟動首次抓取。", "yaml": yaml_text}
    except Exception as e:
        logger.error(f"自動意圖解析或配置失敗: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/delete_target")
async def delete_target(request: Request):
    """
    執行二次確認後的刪除邏輯
    """
    global targets_list
    try:
        data = await request.json()
        target_obj = data.get("target_name")
        
        with open("targets.yaml", "r", encoding="utf-8") as f:
            config_data = yaml.safe_load(f)
            
        old_targets = config_data.get("targets", [])
        new_targets = [t for t in old_targets if t.get("name") != target_obj]
        
        if len(old_targets) == len(new_targets):
            return {"status": "error", "message": "找不到該商品，無法刪除。"}
            
        config_data["targets"] = new_targets
        
        # 重寫 YAML 並保留原本的純淨結構
        with open("targets.yaml", "w", encoding="utf-8") as f:
            f.write("# 目標商品清單\n# 請在這裡定義您想要監控的商品。\n\n")
            yaml.dump(config_data, f, allow_unicode=True, sort_keys=False)
            
        global targets_list, global_stats
        targets_list = load_targets()
        if target_obj in global_stats:
            del global_stats[target_obj]
            
        # 廣播更新
        if loop_ref and manager.active_connections:
            asyncio.run_coroutine_threadsafe(manager.broadcast({"type": "stats_update"}), loop_ref)
            
        return {"status": "success", "message": f"✅ 已成功將【{target_obj}】從追蹤清單中移除。"}
    except Exception as e:
        logger.error(f"刪除目標失敗: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# 負責計算與推播當前所有目標的動態市價 (包含規格細分)
async def send_market_stats():
    stats = []
    for t in targets_list:
        target = t # Use 't' as the target config
        name = target.get("name", "Unknown")
        initial = float(target.get("market_price_estimate", 0))
        category = target.get("category", "phone") # Default to 'phone' if not specified
        
        # 1. 取得歷史數據計算動態市價
        all_stored = database.get_items(limit=100, target_name=name, include_read=True)
        
        # 1. 總體市價
        dyn_price = analyzer.calculate_dynamic_market_price(all_stored, initial, target_config=target)
        stats.append({"name": name, "spec": "", "price": dyn_price})
        
        # 2. 規格細分市價 (從 targets.yaml 定義的規格出發，加上資料庫已有的規格)
        spec_set = set(t.get("spec_prices", {}).keys())
        spec_set.update([i.get("specification") for i in all_stored if i.get("specification")])
        # 取得收購價參考 (從資料庫優先，YAML 為輔)
        db_stats = database.get_market_price_stats(target_name=name)
        buyback_map = {} # spec -> max_price
        for row in db_stats:
            s_name = row['specification']
            s_price = row['buyback_price']
            if s_name not in buyback_map or s_price > buyback_map[s_name]:
                buyback_map[s_name] = s_price
        
        # Fallback to YAML if DB is empty
        yaml_buyback = t.get("buyback_prices", {})
        for src, specs in yaml_buyback.items():
            for s, p in specs.items():
                if s not in buyback_map or p > buyback_map[s]:
                    buyback_map[s] = p

        for s in sorted(list(spec_set)):
            spec_items = [item for item in all_stored if item.get("specification") == s]
            spec_initial_price = t.get("spec_prices", {}).get(s, initial)
            dynamic_price = analyzer.calculate_dynamic_market_price(spec_items, spec_initial_price, s, target_config=t)
            stats.append({
                "name": name,
                "spec": s,
                "market_price": round(dynamic_price),
                "buyback_price": buyback_map.get(s, 0),
                "count": len(spec_items),
                "category": category
            })

    if loop_ref and manager.active_connections:
        await manager.broadcast({"type": "market_stats", "data": stats})

# 同步推波資料的工具函式
def broadcast_new_item(item_type: str, item_data: dict):
    if loop_ref and manager.active_connections:
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "new_item", "item_type": item_type, "data": item_data}),
            loop_ref
        )

def process_target(target):
    try:
        _process_target_inner(target)
    except Exception as e:
        logger.error(f"❌ 處理目標時發生嚴重錯誤 ({target.get('name')}): {e}", exc_info=True)

def _process_target_inner(target):
    name = target.get("name", "Unknown")
    keyword = target.get("keyword", target.get("name"))
    sort_by = str(target.get("sort_by", "3"))
    delay_range = target.get("delay_range", [3, 8])
    initial_market_price = float(target.get("market_price_estimate", 20000))
    dynamic_market_price = None  # 顯式初始化，預防任何 NameError

    # 統計數據 (也會同步到資料庫)
    # 這裡的 global_stats 是累計的，不再按 target name 分開，因為 user 希望看到「總量」

    logger.info(f"== 開始並行偵測目標: {name} ==")
    items = scraper.fetch_carousell_items(keyword, sort_by=sort_by, delay_range=tuple(delay_range))
    
    global_stats["scraped"] += len(items)
    database.update_cumulative_stats("total_scraped", len(items))
    
    # 計算全體動態市價 (用於初步過濾)
    all_stored_items = database.get_items(limit=300, target_name=name, include_read=True)
    dynamic_market_price = analyzer.calculate_dynamic_market_price(all_stored_items, initial_market_price, target_config=target)

    for item in items:
        # 跳過已處理過的
        if database.deal_exists(item["id"]) or database.item_exists(item["id"]):
            continue
            
        # [關鍵優化]：在初步評估前，先用正則快速抓取規格，確保評估時用的基準價是對的
        fast_spec = ai_evaluator.extract_spec_from_text(item["title"])
        item["specification"] = fast_spec
        # 取得該規格對應的收購價辭典 (從 DB 優先，YAML 為輔)
        market_stats = database.get_market_price_stats(target_name=name)
        buyback_prices = {}
        for row in market_stats:
            src = row['source']
            s_name = row['specification']
            s_price = row['buyback_price']
            if src not in buyback_prices: buyback_prices[src] = {}
            buyback_prices[src][s_name] = s_price
            
        yaml_buyback = target.get("buyback_prices", {})
        for src, specs in yaml_buyback.items():
            if src not in buyback_prices: buyback_prices[src] = {}
            for s, p in specs.items():
                if s not in buyback_prices[src]:
                    buyback_prices[src][s] = p
        
        # 3. 初始評估 (計算門檻與初步過濾)
        should_notify, status = analyzer.evaluate_item(
            item, config, target, 
            dynamic_market_price=dynamic_market_price,
            buyback_prices=buyback_prices
        )
        item["status"] = status
        item["target_name"] = name
        
        # 只有當 status 是 Great Deal 或 Special 時，才啟動 AI 海選
        if "Great Deal" in status or status == "Special":
            logger.info(f"[{name}] 發現潛在超值商品: {item['title']}。啟動詳細抓取與 AI 審核...")
            full_desc = scraper.fetch_item_details(item["url"])
            
            # 使用 AI 評估狀況 (不包含價格評分)
            is_good_condition, is_parts, ai_reason, details = ai_evaluator.evaluate_deal(
                item, full_desc, category=category,
                user_prefs=config.get("trading", {}),
                buyback_prices=buyback_prices
            )
            item.update(details) # 合併規格、地點、付款方式、摘要等
            item["ai_reason"] = ai_reason
            
            # 存入資料庫
            if is_parts:
                database.insert_parts_deal(
                    item["id"], item["title"], item["price"], item["url"], item["image_url"], 
                    ai_reason, name, item.get("specification",""), item.get("location",""), item.get("payment",""),
                    is_pickup_available=item.get("is_pickup_available", False),
                    is_cod_available=item.get("is_cod_available", False),
                    battery_health=item.get("battery_info", ""),
                    ai_summary=item.get("ai_summary", ""),
                    category=category
                )
                broadcast_new_item("parts", item)
            elif is_good_condition:
                global_stats["deals"] += 1
                database.update_cumulative_stats("total_deals", 1)
                database.insert_profitable_deal(
                    item["id"], item["title"], item["price"], item["url"], item["image_url"], 
                    ai_reason, name, item.get("specification",""), item.get("location",""), item.get("payment",""),
                    is_pickup_available=item.get("is_pickup_available", False),
                    is_cod_available=item.get("is_cod_available", False),
                    battery_health=item.get("battery_info", ""),
                    ai_summary=item.get("ai_summary", ""),
                    category=category
                )
                notifier.send_telegram_message(config, item)
                broadcast_new_item("deals", item)
        
        # 不論是否為 Deal，只要嚴格符合型號就存入一般庫 (Ignored 除外)
        if "Ignored" not in status:
            global_stats["saved"] += 1
            database.update_cumulative_stats("total_saved", 1)
            database.insert_item(
                item_id=item["id"], title=item["title"], price=item["price"],
                url=item["url"], image_url=item["image_url"], time_str=item["time"],
                status=status, target_name=name, specification=item.get("specification", ""),
                location=item.get("location", ""), payment=item.get("payment", ""),
                is_pickup_available=item.get("is_pickup_available", False),
                is_cod_available=item.get("is_cod_available", False),
                battery_health=item.get("battery_info", ""),
                ai_summary=item.get("ai_summary", ""),
                category=category
            )
            broadcast_new_item("market", item)
    # 背景廣播一次狀態更新，讓前端重整數據
    if loop_ref and manager.active_connections:
        asyncio.run_coroutine_threadsafe(manager.broadcast({"type": "stats_update"}), loop_ref)

async def update_3c_prices():
    """ 背景任務：從 3C 收購商官網抓取最新行情並存入資料庫 """
    logger.info("開始更新 3C 收購行情...")
    targets = load_targets()
    for t in targets:
        name = t.get("name")
        buyback_urls = t.get("buyback_urls", {})
        
        # 遍歷不同來源 (SOGO3C, US3C 等)
        for source, url in buyback_urls.items():
            if not url: continue
            
            prices = {}
            if "us3c" in url.lower():
                prices = scraper.fetch_us3c_prices(url)
            elif "sogo3c" in url.lower():
                prices = scraper.fetch_sogo3c_prices(url)
                
            for spec, price in prices.items():
                database.update_market_price_stats(name, spec, source, price)
                
    logger.info("3C 收購行情更新完成。")

# === 6. 多線程排程系統 ===
def job():
    global targets_list, config
    # 每次執行前確保重新讀取最新配置
    targets_list = load_targets()
    config = load_config()
    
    # 定期更新 3C 行情 (在此處同步執行或非同步)
    asyncio.run(update_3c_prices())
    
    logger.info(f"啟動排程任務，共 {len(targets_list)} 個目標。預計使用多線程平行掃描...")
    if loop_ref:
        asyncio.run_coroutine_threadsafe(send_market_stats(), loop_ref)

    if not targets_list:
         logger.warning("沒有在 targets.yaml 中找到任何目標。")
         return

    # 平行處理所有爬蟲目標
    max_workers = min(len(targets_list), 5)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(process_target, targets_list)
        
    logger.info("所有目標並行爬取與 AI 審核完成。")

def run_scheduler():
    job() # 立刻跑一次
    schedule.every(15).minutes.do(job)
    # 額外排程：每 6 小時強制更新一次 3C 行情 (job 裡已經有跑了，這裡作為補強)
    schedule.every(6).hours.do(lambda: asyncio.run(update_3c_prices()))
    
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
