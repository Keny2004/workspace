import sqlite3
import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DB_PATH = "data/carousell.db"

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return sqlite3.connect(DB_PATH)

def init_db():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            # 建立一般市場行情資料表 (Market History)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    image_url TEXT,
                    time_str TEXT,
                    status TEXT,
                    specification TEXT DEFAULT '',
                    location TEXT DEFAULT '',
                    payment TEXT DEFAULT '',
                    is_read INTEGER DEFAULT 0,
                    is_notified INTEGER DEFAULT 0,
                    is_pickup_available INTEGER DEFAULT 0,
                    is_cod_available INTEGER DEFAULT 0,
                    battery_health TEXT DEFAULT '',
                    ai_summary TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    target_name TEXT DEFAULT '',
                    category TEXT DEFAULT 'phone'
                )
            """)
            # 建立 AI 認證套利資料表 (Profitable Deals)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS profitable_deals (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    image_url TEXT,
                    ai_reason TEXT NOT NULL,
                    specification TEXT DEFAULT '',
                    location TEXT DEFAULT '',
                    payment TEXT DEFAULT '',
                    is_read INTEGER DEFAULT 0,
                    is_pickup_available INTEGER DEFAULT 0,
                    is_cod_available INTEGER DEFAULT 0,
                    battery_health TEXT DEFAULT '',
                    ai_summary TEXT DEFAULT '',
                    target_name TEXT DEFAULT '',
                    category TEXT DEFAULT 'phone',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # 建立 AI 認證零件機資料表 (Parts & Broken Deals)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS parts_deals (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    image_url TEXT,
                    ai_reason TEXT NOT NULL,
                    specification TEXT DEFAULT '',
                    location TEXT DEFAULT '',
                    payment TEXT DEFAULT '',
                    is_read INTEGER DEFAULT 0,
                    is_pickup_available INTEGER DEFAULT 0,
                    is_cod_available INTEGER DEFAULT 0,
                    battery_health TEXT DEFAULT '',
                    ai_summary TEXT DEFAULT '',
                    target_name TEXT DEFAULT '',
                    category TEXT DEFAULT 'phone',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # 建立系統累計統計資料表 (System Stats)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_stats (
                    key TEXT PRIMARY KEY,
                    value INTEGER DEFAULT 0
                )
            """)
            # 建立 3C 收購行情資料表 (Market Price Stats)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS market_price_stats (
                    target_name TEXT,
                    specification TEXT,
                    source TEXT,
                    buyback_price INTEGER,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (target_name, specification, source)
                )
            """)
            # 初始化統計數據 (若不存在)
            stats_keys = ["total_scraped", "total_ignored", "total_saved", "total_deals"]
            for key in stats_keys:
                cursor.execute("INSERT OR IGNORE INTO system_stats (key, value) VALUES (?, 0)", (key,))

            # 檢查並添加缺失的欄位 (遷移邏輯)
            for table in ["items", "profitable_deals", "parts_deals"]:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = [col[1] for col in cursor.fetchall()]
                if "specification" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN specification TEXT DEFAULT ''")
                if "location" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN location TEXT DEFAULT ''")
                if "payment" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN payment TEXT DEFAULT ''")
                if "is_read" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN is_read INTEGER DEFAULT 0")
                if "is_pickup_available" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN is_pickup_available INTEGER DEFAULT 0")
                if "is_cod_available" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN is_cod_available INTEGER DEFAULT 0")
                if "battery_health" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN battery_health TEXT DEFAULT ''")
                if "ai_summary" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN ai_summary TEXT DEFAULT ''")
                if "category" not in columns:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN category TEXT DEFAULT 'phone'")
            conn.commit()
            logger.info("資料庫初始化成功 (包含一般市場、套利庫、零件庫、累計統計數據)。")
    except Exception as e:
        logger.error(f"資料庫初始化失敗: {e}")

# === 統計數據相關 ===
def get_cumulative_stats() -> Dict[str, int]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM system_stats")
            return {row[0]: row[1] for row in cursor.fetchall()}
    except Exception as e:
        logger.error(f"取得累計統計失敗: {e}")
        return {}

def update_cumulative_stats(key: str, increment: int = 1):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE system_stats SET value = value + ? WHERE key = ?", (increment, key))
            conn.commit()
    except Exception as e:
        logger.error(f"更新累計統計失敗 ({key}): {e}")

def get_db_size() -> int:
    """傳回資料庫檔案大小 (Bytes)"""
    try:
        return os.path.getsize(DB_PATH)
    except Exception:
        return 0

def get_row_counts() -> Dict[str, int]:
    """傳回各資料表的行數"""
    counts = {}
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            for table in ["items", "profitable_deals", "parts_deals"]:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                counts[table] = cursor.fetchone()[0]
    except Exception:
        pass
    return counts

# === 商品操作相關 ===
def item_exists(item_id: str) -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM items WHERE id = ?", (item_id,))
            return cursor.fetchone() is not None
    except Exception:
        return False

def insert_item(item_id: str, title: str, price: int, url: str, image_url: str, time_str: str, status: str, target_name: str, 
                specification: str = "", location: str = "", payment: str = "", is_pickup_available: bool = False,
                is_cod_available: bool = False, battery_health: str = "", ai_summary: str = "", category: str = "phone") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO items (id, title, price, url, image_url, time_str, status, target_name, specification, location, payment, 
                                   is_pickup_available, is_cod_available, battery_health, ai_summary, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, time_str, status, target_name, specification, location, payment, 
                  1 if is_pickup_available else 0, 1 if is_cod_available else 0, battery_health, ai_summary, category))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"插入一般商品失敗: {e}")
        return False

def get_items(limit: int = 50, status: Optional[str] = None, target_name: Optional[str] = None, 
              include_read: bool = False, specification: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM items WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if target_name:
                query += " AND target_name = ?"
                params.append(target_name)
            if specification:
                query += " AND specification = ?"
                params.append(specification)
            if category:
                query += " AND category = ?"
                params.append(category)
            if not include_read:
                query += " AND is_read = 0"
            
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"取得一般商品失敗: {e}")
        return []

def deal_exists(item_id: str) -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM profitable_deals WHERE id = ? UNION SELECT 1 FROM parts_deals WHERE id = ?", (item_id, item_id))
            return cursor.fetchone() is not None
    except Exception:
        return False

def insert_profitable_deal(item_id: str, title: str, price: int, url: str, image_url: str, ai_reason: str, target_name: str, 
                           specification: str = "", location: str = "", payment: str = "", is_pickup_available: bool = False,
                           is_cod_available: bool = False, battery_health: str = "", ai_summary: str = "", category: str = "phone") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO profitable_deals (id, title, price, url, image_url, ai_reason, target_name, specification, location, payment, 
                                              is_pickup_available, is_cod_available, battery_health, ai_summary, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, ai_reason, target_name, specification, location, payment, 
                  1 if is_pickup_available else 0, 1 if is_cod_available else 0, battery_health, ai_summary, category))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"插入套利商品失敗: {e}")
        return False

def get_profitable_deals(limit: int = 50, target_name: Optional[str] = None, include_read: bool = False, 
                         specification: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM profitable_deals WHERE 1=1"
            params = []
            if target_name:
                query += " AND target_name = ?"
                params.append(target_name)
            if specification:
                query += " AND specification = ?"
                params.append(specification)
            if category:
                query += " AND category = ?"
                params.append(category)
            if not include_read:
                query += " AND is_read = 0"
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"取得套利商品失敗: {e}")
        return []

        return False
def insert_parts_deal(item_id: str, title: str, price: int, url: str, image_url: str, ai_reason: str, target_name: str, 
                      specification: str = "", location: str = "", payment: str = "", is_pickup_available: bool = False,
                      is_cod_available: bool = False, battery_health: str = "", ai_summary: str = "", category: str = "phone") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO parts_deals (id, title, price, url, image_url, ai_reason, target_name, specification, location, payment, 
                                        is_pickup_available, is_cod_available, battery_health, ai_summary, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, ai_reason, target_name, specification, location, payment, 
                  1 if is_pickup_available else 0, 1 if is_cod_available else 0, battery_health, ai_summary, category))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"插入零件機商品失敗: {e}")
        return False

def get_parts_deals(limit: int = 50, target_name: Optional[str] = None, include_read: bool = False, 
                    specification: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM parts_deals WHERE 1=1"
            params = []
            if target_name:
                query += " AND target_name = ?"
                params.append(target_name)
            if specification:
                query += " AND specification = ?"
                params.append(specification)
            if category:
                query += " AND category = ?"
                params.append(category)
            if not include_read:
                query += " AND is_read = 0"
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"取得零件機商品失敗: {e}")
        return []

def mark_as_notified(item_id: str):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE items SET is_notified = 1 WHERE id = ?", (item_id,))
            conn.commit()
    except Exception as e:
        logger.error(f"標記通知狀態失敗: {e}")

def toggle_is_read(table: str, item_id: str, is_read: int = 1):
    """
    將指定資料表的商品標記為已讀或未讀。
    """
    valid_tables = ["items", "profitable_deals", "parts_deals"]
    if table not in valid_tables:
        return False
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE {table} SET is_read = ? WHERE id = ?", (is_read, item_id))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"標記已讀狀態失敗 ({table}): {e}")
        return False

# === 3C 收購行情操作 ===
def update_market_price_stats(target_name: str, specification: str, source: str, buyback_price: int):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO market_price_stats (target_name, specification, source, buyback_price, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (target_name, specification, source, buyback_price))
            conn.commit()
    except Exception as e:
        logger.error(f"更新 3C 行情失敗: {e}")

def get_market_price_stats(target_name: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if target_name:
                cursor.execute("SELECT * FROM market_price_stats WHERE target_name = ?", (target_name,))
            else:
                cursor.execute("SELECT * FROM market_price_stats")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"取得 3C 行情失敗: {e}")
        return []

# === 維護功能 ===
def clear_items():
    """清空所有抓取到的商品資料"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM items")
            cursor.execute("DELETE FROM profitable_deals")
            cursor.execute("DELETE FROM parts_deals")
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"清空商品資料失敗: {e}")
        return False

def clear_market_stats():
    """清空所有 3C 行情資料"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM market_price_stats")
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"清空行情資料失敗: {e}")
        return False

def delete_specific_item(item_id: str):
    """刪除指定 ID 的商品"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM items WHERE id = ?", (item_id,))
            cursor.execute("DELETE FROM profitable_deals WHERE id = ?", (item_id,))
            cursor.execute("DELETE FROM parts_deals WHERE id = ?", (item_id,))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"刪除商品失敗 ({item_id}): {e}")
        return False
