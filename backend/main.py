from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import asyncio
import datetime
from typing import List, Optional, Union
import psutil
import json
import os

import datetime
from .database import get_db, init_db, SessionLocal
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
        ("ollama_model", "qwen3.5:4b"),
        ("app_url", "http://localhost:3000"),
        ("crawl_interval_mins", "30"),
        ("ai_prediction_interval_hours", "1"),
        ("summary_sweep_interval_mins", "10"),
        ("metadata_enrichment_interval_mins", "15")
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
def get_products(is_potential: bool = False, show_ignored: bool = False, show_all: bool = False, limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(models.ScrapedProduct)
    
    if show_all:
        pass # Return everything
    elif show_ignored:
        # Show items that are either not potential profit OR are explicitly ignored by user
        query = query.filter(
            (models.ScrapedProduct.is_potential_profit == False) | 
            (models.ScrapedProduct.is_ignored_by_user == True)
        )
    else:
        # Normal flow: completely hide ignored items
        query = query.filter(models.ScrapedProduct.is_ignored_by_user == False)
        if is_potential:
            query = query.filter(models.ScrapedProduct.is_potential_profit == True)
    
    products = query.order_by(models.ScrapedProduct.scraped_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for p in products:
        spec = p.specification
        if not spec or not spec.is_monitored: continue
        # 1. Target Market Price (using centralized logic)
        from .services.product_service import ProductService
        ps = ProductService(db)
        target_market_price = ps.get_target_price(spec)
        
        # Only show profit if the item passed our potential profit filters
        if p.is_potential_profit:
            est_profit = target_market_price - p.price if target_market_price > 0 else 0
            profit_percent = round((est_profit / p.price) * 100, 1) if p.price > 0 else 0
        else:
            est_profit = 0
            profit_percent = 0
        
        result.append({
            "id": p.id,
            "category": spec.model.category.name if spec.model and spec.model.category else "Unknown",
            "model": spec.model.name if spec.model else "Unknown",
            "specification": spec.name if spec else "Unknown",
            "platform": p.platform,
            "title": p.title,
            "price": p.price,
            "market_price": target_market_price,
            "estimated_profit": est_profit,
            "profit_margin_percent": profit_percent,
            "url": p.url,
            "scraped_at": p.scraped_at,
            "description": p.description,
            "metadata": p.raw_metadata,
            "ai_summary": p.ai_summary,
            "is_potential": p.is_potential_profit,
            "is_ai_validated": p.is_ai_validated,
            "is_faulty": p.is_faulty,
            "tags": p.tags
        })
    return result

@app.get("/api/market-prices")
def get_market_prices(spec_id: int, db: Session = Depends(get_db)):
    return db.query(models.MarketPrice).filter(
        models.MarketPrice.specification_id == spec_id
    ).order_by(models.MarketPrice.updated_at.asc()).all()

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    from .models import CrawlerStats
    # Get today's stats and overall stats
    today = datetime.datetime.now().date()
    today_stat = db.query(CrawlerStats).filter(
        CrawlerStats.date >= datetime.datetime.combine(today, datetime.time.min),
        CrawlerStats.date <= datetime.datetime.combine(today, datetime.time.max)
    ).first()
    
    total_scanned = db.query(models.ScrapedProduct).count()
    total_potential = db.query(models.ScrapedProduct).filter(models.ScrapedProduct.is_potential_profit == True).count()
    
    return {
        "today": {
            "scanned": today_stat.scanned_count if today_stat else 0,
            "filtered": today_stat.filtered_count if today_stat else 0,
            "potential": today_stat.potential_count if today_stat else 0
        },
        "overall": {
            "scanned": total_scanned,
            "potential": total_potential
        }
    }

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.ScrapedProduct).filter(models.ScrapedProduct.id == product_id).first()
    if product:
        # Soft delete: mark as ignored instead of removing from DB
        product.is_ignored_by_user = True
        product.is_potential_profit = False
        db.commit()
    return {"status": "success"}

@app.post("/api/products/{product_id}/refresh-ai")
def refresh_product_ai(product_id: int, db: Session = Depends(get_db)):
    from .services.product_service import ProductService
    product = db.query(models.ScrapedProduct).filter(models.ScrapedProduct.id == product_id).first()
    if not product:
        return {"status": "error", "message": "Product not found"}
        
    spec = product.specification
    if not spec:
        return {"status": "error", "message": "No specification linked"}
        
    ps = ProductService(db)
    
    benchmark = db.query(models.MarketPrice).filter(
        models.MarketPrice.specification_id == spec.id
    ).order_by(models.MarketPrice.updated_at.desc()).first()
    benchmark_price = benchmark.price if benchmark else 0
    
    profit_percent_str = ps.get_config(f"profit_margin", "30")
    if spec.model and spec.model.category:
        profit_percent_str = ps.get_config(f"profit_margin_{spec.model.category.name}", "30")
    try:
        profit_margin_percent = float(profit_percent_str)
    except:
        profit_margin_percent = 30.0

    summary = ps.validate_and_summarize_with_ai(product, benchmark_price, profit_margin_percent)
    if summary or summary == "":
        return {
            "status": "success", 
            "ai_summary": product.ai_summary, 
            "is_potential_profit": product.is_potential_profit, 
            "is_faulty": product.is_faulty
        }
    else:
        return {"status": "error", "message": "Failed to generate summary or product excluded by AI"}

@app.post("/api/products/refresh-all-ai")
def refresh_all_products_ai():
    import threading
    def background_refresh():
        db = SessionLocal()
        try:
            from .services.product_service import ProductService
            ps = ProductService(db)
            ps.refresh_all_recommended_ai(check_abort=lambda: scheduler.is_paused or not scheduler.is_ai_running)
        except Exception as e:
            print(f"Background refresh all AI failed: {e}")
        finally:
            db.close()
    
    threading.Thread(target=background_refresh, daemon=True).start()
    return {"status": "started", "message": "Global AI refresh started in background"}

@app.get("/api/market-predictions")
def get_market_predictions(db: Session = Depends(get_db)):
    from .models import MarketPrediction, Specification
    from sqlalchemy.orm import joinedload
    predictions = db.query(MarketPrediction).options(
        joinedload(MarketPrediction.specification).joinedload(Specification.model)
    ).all()
    # Add manual price from specification to the response
    results = []
    import json
    for p in predictions:
        ai_data = None
        if p.ai_analysis:
            try:
                ai_data = json.loads(p.ai_analysis)
            except:
                ai_data = None
        
        # Get manual price from associated market prices
        manual_price = next((mp.price for mp in p.specification.market_prices if mp.source == "Manual"), 0)
                
        results.append({
            "id": p.id,
            "specification_id": p.specification_id,
            "model_name": p.specification.model.name if p.specification.model else "Unknown",
            "specification_name": p.specification.name,
            "predicted_price": p.predicted_price,
            "sample_size": p.sample_size,
            "updated_at": p.updated_at,
            "user_manual_price": manual_price,
            "ai_analysis": ai_data
        })
    return results

@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(models.Category).all()
    results = []
    for cat in categories:
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "custom_margin": cat.custom_margin,
            "models": []
        }
        for model in cat.models:
            model_dict = {
                "id": model.id,
                "name": model.name,
                "specifications": []
            }
            for spec in model.specifications:
                model_dict["specifications"].append({
                    "id": spec.id,
                    "name": spec.name,
                    "is_monitored": spec.is_monitored,
                    "custom_margin": spec.custom_margin,
                    "recommend_faulty": spec.recommend_faulty
                })
            cat_dict["models"].append(model_dict)
        results.append(cat_dict)
    return results

@app.post("/api/categories/{category_id}/margin")
def update_category_margin(category_id: int, margin_data: dict, db: Session = Depends(get_db)):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        return {"status": "error", "message": "Category not found"}
    cat.custom_margin = margin_data.get('margin')
    db.commit()
    return {"status": "success", "margin": cat.custom_margin}

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
    # 重新加載排程間隔
    scheduler.reload_intervals()
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

@app.post("/api/ai/summarize/trigger")
def trigger_ai_summarization():
    import threading
    threading.Thread(target=scheduler.sweep_missing_summaries).start()
    return {"status": "started"}

@app.post("/api/ai/predict/trigger")
def trigger_ai_predict():
    import threading
    threading.Thread(target=scheduler.run_ai_predictions).start()
    return {"status": "started"}

@app.post("/api/crawl/pause")
def pause_crawl():
    scheduler.is_paused = True
    return {"status": "paused"}

@app.post("/api/crawl/resume")
def resume_crawl():
    scheduler.is_paused = False
    return {"status": "resumed"}

@app.post("/api/system/stop-all")
def stop_all_services():
    scheduler.stop_all()
    return {"status": "stopped", "message": "All background services have been halted."}

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
                "is_monitored": spec.is_monitored,
                "custom_margin": spec.custom_margin,
                "recommend_faulty": spec.recommend_faulty
            })
            
    return latest_prices

    spec.is_monitored = not spec.is_monitored
    db.commit()
    return {"status": "success", "is_monitored": spec.is_monitored}

@app.post("/api/specifications/{spec_id}/toggle-monitor")
def toggle_monitor(spec_id: int, db: Session = Depends(get_db)):
    spec = db.query(models.Specification).filter(models.Specification.id == spec_id).first()
    if not spec:
        return {"status": "error", "message": "Specification not found"}
    
    spec.is_monitored = not spec.is_monitored
    db.commit()
    return {"status": "success", "is_monitored": spec.is_monitored}

class SpecificationUpdateRequest(BaseModel):
    custom_margin: Optional[float] = None
    is_monitored: Optional[bool] = None
    recommend_faulty: Optional[bool] = None

@app.patch("/api/specifications/{spec_id}")
def update_specification(spec_id: int, req: SpecificationUpdateRequest, db: Session = Depends(get_db)):
    spec = db.query(models.Specification).filter(models.Specification.id == spec_id).first()
    if not spec:
        return {"status": "error", "message": "Specification not found"}
    
    if req.custom_margin is not None:
        spec.custom_margin = req.custom_margin
    if req.is_monitored is not None:
        spec.is_monitored = req.is_monitored
    if req.recommend_faulty is not None:
        spec.recommend_faulty = req.recommend_faulty
        
    db.commit()
    return {"status": "success"}

class ImportURLRequest(BaseModel):
    url: str
    category_id: int

class ManualPriceRequest(BaseModel):
    category: str
    model: str
    specification: str
    price: float
    custom_margin: Optional[float] = None

@app.get("/api/admin/db-cleanup/preview")
def cleanup_database_preview(db: Session = Depends(get_db)):
    """
    Simulate intensive cleanup and return expected stats.
    """
    stats = {"models_merged": 0, "specs_merged": 0, "prices_cleaned": 0, "products_cleaned": 0}
    
    # 1. Merge ProductModels
    categories = db.query(models.Category).all()
    for cat in categories:
        model_groups = {}
        for m in cat.models:
            name = m.name.strip().lower()
            if name not in model_groups: model_groups[name] = []
            model_groups[name].append(m)
        for m_list in model_groups.values():
            if len(m_list) > 1:
                stats["models_merged"] += len(m_list) - 1

    # 2. Merge Specifications
    all_models = db.query(models.ProductModel).all()
    for m in all_models:
        spec_groups = {}
        for s in m.specifications:
            name = s.name.strip().lower()
            if name not in spec_groups: spec_groups[name] = []
            spec_groups[name].append(s)
        for s_list in spec_groups.values():
            if len(s_list) > 1:
                stats["specs_merged"] += len(s_list) - 1

    # 3. Deduplicate MarketPrices
    all_prices = db.query(models.MarketPrice).order_by(models.MarketPrice.updated_at.desc()).all()
    seen_prices = set()
    for p in all_prices:
        key = (p.specification_id, (p.source or "Unknown").strip())
        if key in seen_prices:
            stats["prices_cleaned"] += 1
        else:
            seen_prices.add(key)

    # 4. Deduplicate ScrapedProducts
    all_prods = db.query(models.ScrapedProduct).order_by(models.ScrapedProduct.scraped_at.desc()).all()
    seen_prods = set()
    for p in all_prods:
        key = (p.external_id, p.platform)
        if key in seen_prods:
            stats["products_cleaned"] += 1
        else:
            seen_prods.add(key)

    return {"status": "success", "stats": stats}

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

@app.post("/api/market-prices/manual")
def create_manual_price(req: ManualPriceRequest, db: Session = Depends(get_db)):
    # 1. Get/Create Category
    cat = db.query(models.Category).filter(models.Category.name == req.category).first()
    if not cat:
        cat = models.Category(name=req.category)
        db.add(cat)
        db.commit()
        db.refresh(cat)
    
    # 2. Get/Create Model
    pmodel = db.query(models.ProductModel).filter(
        models.ProductModel.category_id == cat.id,
        models.ProductModel.name == req.model
    ).first()
    if not pmodel:
        pmodel = models.ProductModel(category_id=cat.id, name=req.model)
        db.add(pmodel)
        db.commit()
        db.refresh(pmodel)
        
    # 3. Get/Create Specification
    spec = db.query(models.Specification).filter(
        models.Specification.model_id == pmodel.id,
        models.Specification.name == req.specification
    ).first()
    if not spec:
        spec = models.Specification(model_id=pmodel.id, name=req.specification, is_monitored=True)
        db.add(spec)
        db.commit()
        db.refresh(spec)
    else:
        # User manually added it, so they probably want to monitor it
        spec.is_monitored = True
    
    # 4. Create/Update MarketPrice
    mprice = db.query(models.MarketPrice).filter(
        models.MarketPrice.specification_id == spec.id,
        models.MarketPrice.source == "Manual"
    ).first()
    
    if mprice:
        mprice.price = req.price
        mprice.updated_at = datetime.datetime.utcnow()
    else:
        mprice = models.MarketPrice(
            specification_id=spec.id,
            price=req.price,
            source="Manual"
        )
        db.add(mprice)
    
    if req.custom_margin is not None:
        spec.custom_margin = req.custom_margin
    
    db.commit()
    return {"status": "success"}

class ListingRequest(BaseModel):
    product_name: str
    condition: str
    target_price: str
    platform: str

@app.post("/api/ai/generate-listing")
def generate_listing(req: ListingRequest, db: Session = Depends(get_db)):
    from .config_utils import get_config_value
    import requests
    
    ollama_url = get_config_value("ollama_url", "http://localhost:11434/api/generate")
    model = get_config_value("ollama_model", "qwen3.5:4b")
    
    prompt = f"""你是一個專業的二手 3C 拍賣賣家，請幫我寫一篇吸引人的商品銷售文案。
目標平台：{req.platform}
商品名稱：{req.product_name}
商品機況：{req.condition}
預計售價：{req.target_price}

要求格式：
1. 【吸睛標題】(包含必要關鍵字與狀態)
2. 【商品特色/機況描述】(將機況包裝得專業、真誠)
3. 【交易方式】(面交/寄送)
4. 最下方加上 5-8 個熱門 Hashtag。

請直接依照格式輸出文案結果，不需要其他的開場白或結語：
"""
    try:
        response = requests.post(ollama_url, json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }, timeout=300)
        if response.status_code == 200:
            result_text = response.json().get("response", "").strip()
            return {"status": "success", "data": result_text}
    except Exception as e:
        print(f"Listing generation failed: {e}")
        return {"status": "error", "message": str(e)}
        
    return {"status": "error", "message": "Failed to connect to AI model"}
