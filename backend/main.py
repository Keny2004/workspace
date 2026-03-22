from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import asyncio
import psutil
import json
import os

from .database import get_db, init_db
from . import models
from .services.scheduler import SchedulerService

app = FastAPI(title="3C Second-hand Monitoring System")
scheduler = SchedulerService()

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    scheduler.start()

# WebSocket for system status
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/status")
async def websocket_status(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Send system stats periodically
            status_data = {
                "cpu": psutil.cpu_percent(),
                "ram": psutil.virtual_memory().percent,
                "crawler_status": "crawling" if scheduler.is_crawling else "idle",
                "ai_status": "running" if scheduler.is_ai_running else "idle",
                "is_paused": scheduler.is_paused,
                "db_count": db.query(models.ScrapedProduct).count()
            }
            await websocket.send_text(json.dumps(status_data))
            await asyncio.sleep(2) # Update every 2 seconds
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()
    log_file = "backend.log"
    if not os.path.exists(log_file):
        await websocket.send_text("Log file not found.")
        await websocket.close()
        return

    try:
        with open(log_file, "r") as f:
            # Send last 100 lines initially
            lines = f.readlines()
            for line in lines[-100:]:
                await websocket.send_text(line)
            
            # Follow the file
            f.seek(0, os.SEEK_END)
            while True:
                line = f.readline()
                if not line:
                    await asyncio.sleep(0.5)
                    continue
                await websocket.send_text(line)
    except Exception as e:
        print(f"Log WebSocket error: {e}")
    finally:
        await websocket.close()

@app.get("/api/products")
def get_products(is_potential: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.ScrapedProduct)
    if is_potential:
        query = query.filter(models.ScrapedProduct.is_potential_profit == True)
    products = query.order_by(models.ScrapedProduct.scraped_at.desc()).all()
    
    result = []
    for p in products:
        p_dict = {
            "id": p.id,
            "specification_id": p.specification_id,
            "platform": p.platform,
            "external_id": p.external_id,
            "title": p.title,
            "price": p.price,
            "url": p.url,
            "image_url": p.image_url,
            "is_potential_profit": p.is_potential_profit,
            "ai_summary": p.ai_summary,
            "scraped_at": p.scraped_at,
            "estimated_profit": 0,
            "profit_margin_percent": 0
        }
        
        benchmark = db.query(models.MarketPrice).filter(
            models.MarketPrice.specification_id == p.specification_id
        ).order_by(models.MarketPrice.updated_at.desc()).first()
        
        if benchmark and p.price > 0:
            profit = benchmark.price - p.price
            p_dict["estimated_profit"] = profit
            p_dict["profit_margin_percent"] = round((profit / p.price) * 100, 1)
            
        result.append(p_dict)
    return result

@app.get("/api/market-prices")
def get_market_prices(spec_id: int, db: Session = Depends(get_db)):
    return db.query(models.MarketPrice).filter(
        models.MarketPrice.specification_id == spec_id
    ).order_by(models.MarketPrice.updated_at.asc()).all()

@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    return db.query(models.Category).options(
        joinedload(models.Category.models).joinedload(models.ProductModel.specifications)
    ).all()

@app.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    return db.query(models.SystemConfig).all()

@app.post("/api/config")
def update_config(config_data: dict, db: Session = Depends(get_db)):
    for key, value in config_data.items():
        conf = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
        if conf:
            conf.value = str(value)
        else:
            db.add(models.SystemConfig(key=key, value=str(value)))
    db.commit()
    return {"status": "success"}
@app.post("/api/crawl")
def trigger_crawl():
    if scheduler.is_paused:
        return {"status": "error", "message": "Crawler is paused. Resume it first."}
    asyncio.create_task(asyncio.to_thread(scheduler.crawl_products))
    return {"status": "started"}

@app.post("/api/crawl/pause")
def pause_crawl():
    scheduler.is_paused = True
    return {"status": "paused"}

@app.post("/api/crawl/resume")
def resume_crawl():
    scheduler.is_paused = False
    return {"status": "resumed"}

# --- Category Management ---
@app.post("/api/categories")
def create_category(name: str, db: Session = Depends(get_db)):
    db_cat = models.Category(name=name)
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if cat:
        db.delete(cat)
        db.commit()
    return {"status": "success"}

# --- Model Management ---
@app.post("/api/models")
def create_model(category_id: int, name: str, db: Session = Depends(get_db)):
    db_model = models.ProductModel(category_id=category_id, name=name)
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@app.delete("/api/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    mod = db.query(models.ProductModel).filter(models.ProductModel.id == model_id).first()
    if mod:
        db.delete(mod)
        db.commit()
    return {"status": "success"}

# --- Specification Management ---
@app.post("/api/specifications")
def create_spec(model_id: int, name: str, db: Session = Depends(get_db)):
    db_spec = models.Specification(model_id=model_id, name=name)
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)
    return db_spec

@app.delete("/api/specifications/{spec_id}")
def delete_spec(spec_id: int, db: Session = Depends(get_db)):
    spec = db.query(models.Specification).filter(models.Specification.id == spec_id).first()
    if spec:
        db.delete(spec)
        db.commit()
    return {"status": "success"}

@app.post("/api/update-prices")
def trigger_price_update():
    import threading
    threading.Thread(target=scheduler.update_market_prices).start()
    return {"status": "started"}

@app.delete("/api/products/clear")
def clear_products(db: Session = Depends(get_db)):
    db.query(models.ScrapedProduct).delete()
    db.commit()
    return {"status": "success"}

@app.post("/api/test-telegram")
async def test_telegram(data: dict):
    token = data.get("token")
    user_id = data.get("user_id")
    if not token or not user_id:
        return {"status": "error", "message": "Missing token or user_id"}
    
    from .services.telegram_service import TelegramService
    ts = TelegramService()
    # Temporarily override token/user_id for testing
    import os
    orig_token = os.getenv("TELEGRAM_BOT_TOKEN")
    orig_user = os.getenv("TELEGRAM_USER_ID")
    
    os.environ["TELEGRAM_BOT_TOKEN"] = token
    os.environ["TELEGRAM_USER_ID"] = user_id
    
    success = ts.send_notification("✅ 3C 監控系統：Telegram 通知測試成功！\n此訊息代表您的 Bot Token 與 User ID 配置正確。")
    
    # Restore (though env vars aren't really persistent this way in a running process, 
    # but TelegramService might have cached them. ts currently reads from env on each call?)
    # Let's check TelegramService implementation.
    
    return {"status": "success" if success else "error"}

@app.get("/api/market-prices/all")
def get_all_market_prices(db: Session = Depends(get_db)):
    prices = db.query(models.MarketPrice).all()
    # Join with spec/model for display
    result = []
    for p in prices:
        spec = db.query(models.Specification).filter(models.Specification.id == p.specification_id).first()
        if spec:
            result.append({
                "id": p.id,
                "category": spec.model.category.name,
                "model": spec.model.name,
                "specification": spec.name,
                "price": p.price,
                "source": p.source or "Unknown",
                "updated_at": p.updated_at
            })
    return result

class ImportURLRequest(BaseModel):
    url: str
    category_id: int

@app.post("/api/market-prices/import-url")
def import_valuation_url(req: ImportURLRequest, db: Session = Depends(get_db)):
    count = scheduler.sync_valuation_url(db, req.url, req.category_id)
    if count == 0:
        return {"status": "error", "message": "Failed to scrape or no data found."}
        
    conf = db.query(models.SystemConfig).filter(models.SystemConfig.key == "valuation_urls").first()
    urls_list = json.loads(conf.value) if conf and conf.value else []
    
    if not any(u['url'] == req.url for u in urls_list):
        urls_list.append({"url": req.url, "category_id": req.category_id})
        if conf:
            conf.value = json.dumps(urls_list)
        else:
            db.add(models.SystemConfig(key="valuation_urls", value=json.dumps(urls_list)))
        db.commit()
    
    return {"status": "success", "imported_count": count}
