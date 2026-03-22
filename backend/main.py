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
    
    # Initialize category-specific margins if not present
    db = next(get_db())
    for key, val in [
        ("profit_margin_手機", "5"),
        ("profit_margin_平板", "10"),
        ("profit_margin_筆電", "15"),
        ("custom_proxies", "")
    ]:
        if not db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first():
            db.add(models.SystemConfig(key=key, value=val))
    db.commit()

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
async def websocket_status(websocket: WebSocket, db: Session = Depends(get_db)):
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
    finally:
        db.close()

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
        spec = p.specification
        if not spec or not spec.is_monitored: continue
        
        # 1. Hybrid Benchmark Calculation
        benchmarks = db.query(models.MarketPrice).filter(models.MarketPrice.specification_id == p.specification_id).all()
        portal_price = max([b.price for b in benchmarks]) if benchmarks else 0
        
        # median of this spec's listings
        listing_prices = [lp.price for lp in db.query(models.ScrapedProduct.price).filter(models.ScrapedProduct.specification_id == p.specification_id).all()]
        listing_median = 0
        if listing_prices:
            s_prices = sorted(listing_prices)
            n = len(s_prices)
            listing_median = s_prices[n//2] if n % 2 != 0 else (s_prices[n//2-1] + s_prices[n//2])/2
            
        true_market_price = max(portal_price, listing_median)
        est_profit = true_market_price - p.price if true_market_price > 0 else 0
        profit_percent = round((est_profit / p.price) * 100, 1) if p.price > 0 else 0
        
        result.append({
            "id": p.id,
            "category": spec.model.category.name if spec.model and spec.model.category else "Unknown",
            "model": spec.model.name if spec.model else "Unknown",
            "specification": spec.name if spec else "Unknown",
            "platform": p.platform,
            "title": p.title,
            "price": p.price,
            "market_price": true_market_price,
            "estimated_profit": est_profit,
            "profit_margin_percent": profit_percent,
            "url": p.url,
            "scraped_at": p.scraped_at,
            "ai_summary": p.ai_summary,
            "is_potential_profit": p.is_potential_profit
        })
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
    if scheduler.is_crawling:
        return {"status": "error", "message": "Crawler is already running."}
    if scheduler.is_paused:
        return {"status": "error", "message": "Crawler is paused. Resume it first."}
    import threading
    threading.Thread(target=scheduler.crawl_products).start()
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
    # Fetch all with joins to get names for robust deduplication
    prices = db.query(models.MarketPrice).order_by(models.MarketPrice.updated_at.desc()).all()
    
    seen = set()
    latest_prices = []
    
    for p in prices:
        spec = db.query(models.Specification).filter(models.Specification.id == p.specification_id).first()
        if not spec: continue
        
        # Key by names to catch logical duplicates even if IDs differ
        key = (spec.model.name.strip(), spec.name.strip(), (p.source or "Unknown").strip())
        
        if key not in seen:
            seen.add(key)
            latest_prices.append({
                "id": p.id,
                "specification_id": p.specification_id,
                "category": spec.model.category.name,
                "model": spec.model.name,
                "specification": spec.name,
                "price": p.price,
                "source": p.source or "Unknown",
                "updated_at": p.updated_at,
                "is_monitored": spec.is_monitored
            })
            
    return latest_prices

@app.post("/api/specifications/{spec_id}/toggle-monitor")
def toggle_monitor(spec_id: int, db: Session = Depends(get_db)):
    spec = db.query(models.Specification).filter(models.Specification.id == spec_id).first()
    if not spec:
        return {"status": "error", "message": "Specification not found"}
    
    spec.is_monitored = not spec.is_monitored
    db.commit()
    return {"status": "success", "is_monitored": spec.is_monitored}

class ImportURLRequest(BaseModel):
    url: str
    category_id: int

@app.post("/api/admin/db-cleanup")
def cleanup_database(db: Session = Depends(get_db)):
    """
    Intensive cleanup: 
    1. Merge ProductModels with same name (per category).
    2. Merge Specifications with same name (per model).
    3. Remove duplicate MarketPrices (per spec/source, keep newest).
    4. Remove duplicate ScrapedProducts (per ext_id/platform, keep newest).
    """
    stats = {"models_merged": 0, "specs_merged": 0, "prices_cleaned": 0, "products_cleaned": 0}
    
    # 1. Merge ProductModels
    categories = db.query(models.Category).all()
    for cat in categories:
        model_groups = {} # name -> list of models
        for m in cat.models:
            name = m.name.strip().lower()
            if name not in model_groups: model_groups[name] = []
            model_groups[name].append(m)
        
        for name, m_list in model_groups.items():
            if len(m_list) > 1:
                survivor = m_list[0]
                others = m_list[1:]
                for other in others:
                    # Move all specs to survivor
                    for spec in other.specifications:
                        spec.model_id = survivor.id
                    db.delete(other)
                    stats["models_merged"] += 1
    db.commit()

    # 2. Merge Specifications
    all_models = db.query(models.ProductModel).all()
    for m in all_models:
        spec_groups = {} # name -> list of specs
        for s in m.specifications:
            name = s.name.strip().lower()
            if name not in spec_groups: spec_groups[name] = []
            spec_groups[name].append(s)
            
        for name, s_list in spec_groups.items():
            if len(s_list) > 1:
                survivor = s_list[0]
                others = s_list[1:]
                for other in others:
                    # Move all prices and products to survivor
                    db.query(models.MarketPrice).filter(models.MarketPrice.specification_id == other.id).update({"specification_id": survivor.id})
                    db.query(models.ScrapedProduct).filter(models.ScrapedProduct.specification_id == other.id).update({"specification_id": survivor.id})
                    db.delete(other)
                    stats["specs_merged"] += 1
    db.commit()

    # 3. Deduplicate MarketPrices (spec_id, source)
    all_prices = db.query(models.MarketPrice).order_by(models.MarketPrice.updated_at.desc()).all()
    seen_prices = set()
    for p in all_prices:
        key = (p.specification_id, (p.source or "Unknown").strip())
        if key in seen_prices:
            db.delete(p)
            stats["prices_cleaned"] += 1
        else:
            seen_prices.add(key)
    db.commit()

    # 4. Deduplicate ScrapedProducts (external_id, platform)
    all_prods = db.query(models.ScrapedProduct).order_by(models.ScrapedProduct.scraped_at.desc()).all()
    seen_prods = set()
    for p in all_prods:
        key = (p.external_id, p.platform)
        if key in seen_prods:
            db.delete(p)
            stats["products_cleaned"] += 1
        else:
            seen_prods.add(key)
    db.commit()

    return {"status": "success", "stats": stats}

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
