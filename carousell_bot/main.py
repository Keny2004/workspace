import time
import threading
import logging
import yaml
import schedule
import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

import database
import scraper
import analyzer
import notifier
import ai_evaluator

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load configs
try:
    with open("config.yaml", "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
except Exception as e:
    logger.error(f"Failed to load config.yaml: {e}")
    config = {
        "analysis": {"great_deal_threshold": 0.85, "blacklist_keywords": [], "special_classification_keywords": []},
        "telegram": {"bot_token": "", "chat_id": ""}
    }

try:
    with open("targets.yaml", "r", encoding="utf-8") as f:
        targets_list = yaml.safe_load(f).get("targets", [])
except Exception as e:
    logger.error(f"Failed to load targets.yaml: {e}")
    targets_list = []

app = FastAPI(title="Carousell AI Bot Dashboard")
app.mount("/static", StaticFiles(directory="web"), name="static")

@app.on_event("startup")
def startup_event():
    logger.info("Initializing database...")
    database.init_db()
    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("web/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/api/deals")
def get_deals(limit: int = 150, target: str = None):
    # API now returns PROFITABLE deals verified by AI
    deals = database.get_profitable_deals(limit, target)
    return {"status": "success", "data": deals}

@app.get("/api/market")
def get_market(limit: int = 150, target: str = None):
    # Returns market history cache
    items = database.get_items(limit, None, target)
    return {"status": "success", "data": items}

def process_target(target):
    name = target.get("name", "Unknown")
    keyword = target.get("keyword")
    sort_by = str(target.get("sort_by", "3"))
    delay_range = target.get("delay_range", [3, 8])
    initial_market_price = float(target.get("market_price_estimate", 20000))

    logger.info(f"== Processing Target: {name} ==")
    items = scraper.fetch_carousell_items(keyword, sort_by=sort_by, delay_range=tuple(delay_range))
    
    # Calculate dynamic market price from DB history
    all_stored_items = database.get_items(limit=300, target_name=name)
    dynamic_market_price = analyzer.calculate_dynamic_market_price(all_stored_items, initial_market_price)
    logger.info(f"Target [{name}]: Estimated market price = NT$ {dynamic_market_price:.2f}")

    for item in items:
        # Skip if already evaluated and saved in one of the tables
        if database.deal_exists(item["id"]) or database.item_exists(item["id"]):
            continue
            
        should_notify, status = analyzer.evaluate_item(item, config, target, dynamic_market_price)
        item["status"] = status
        item["target_name"] = name
        
        # Save to basic DB if it's a valid market item (not completely junk)
        if "Ignored" not in status:
            database.insert_item(
                item_id=item["id"], title=item["title"], price=item["price"],
                url=item["url"], image_url=item["image_url"], time_str=item["time"],
                status=status, target_name=name
            )
            
            # Sub-pipeline: Deep Scrape & Local AI Evaluation 
            if status in ["Great Deal", "Special"]:
                logger.info(f"[{name}] Potential arbitrage: {item['title']} - {status}. Initiating Deep Scrape & AI Check...")
                description = scraper.fetch_item_details(item["url"], tuple(delay_range))
                is_good, ai_reason = ai_evaluator.evaluate_deal(item, description)
                item["ai_reason"] = ai_reason
                
                if is_good:
                    logger.info(f"✨ AI Approved Deal: {item['title']}")
                    inserted = database.insert_profitable_deal(
                        item_id=item["id"], title=item["title"], price=item["price"],
                        url=item["url"], image_url=item["image_url"], ai_reason=ai_reason, target_name=name
                    )
                    
                    if inserted:
                        item_copy = dict(item)
                        item_copy['title'] += f"\n🤖 AI分析: {ai_reason}"
                        if notifier.send_telegram_message(config, item_copy):
                            database.mark_as_notified(item["id"])
                else:
                    logger.info(f"❌ AI Rejected: {ai_reason}")

def job():
    logger.info("Starting scheduled Carousell scrape job...")
    for target in targets_list:
        process_target(target)
    logger.info("Scrape job completed.")

def run_scheduler():
    job() # Run once immediately
    schedule.every(15).minutes.do(job)
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
