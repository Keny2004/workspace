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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    target_name TEXT DEFAULT ''
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
                    target_name TEXT DEFAULT '',
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
                    target_name TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
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
            conn.commit()
            logger.info("資料庫初始化成功 (包含一般市場、套利庫、零件庫)。")
    except Exception as e:
        logger.error(f"資料庫初始化失敗: {e}")

def item_exists(item_id: str) -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM items WHERE id = ?", (item_id,))
            return cursor.fetchone() is not None
    except Exception:
        return False

def insert_item(item_id: str, title: str, price: int, url: str, image_url: str, time_str: str, status: str, target_name: str, specification: str = "", location: str = "", payment: str = "") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO items (id, title, price, url, image_url, time_str, status, target_name, specification, location, payment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, time_str, status, target_name, specification, location, payment))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"插入一般商品失敗: {e}")
        return False

def get_items(limit: int = 50, status: Optional[str] = None, target_name: Optional[str] = None, include_read: bool = False, specification: Optional[str] = None) -> List[Dict[str, Any]]:
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

def insert_profitable_deal(item_id: str, title: str, price: int, url: str, image_url: str, ai_reason: str, target_name: str, specification: str = "", location: str = "", payment: str = "") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO profitable_deals (id, title, price, url, image_url, ai_reason, target_name, specification, location, payment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, ai_reason, target_name, specification, location, payment))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"插入套利商品失敗: {e}")
        return False

def get_profitable_deals(limit: int = 50, target_name: Optional[str] = None, include_read: bool = False, specification: Optional[str] = None) -> List[Dict[str, Any]]:
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

def insert_parts_deal(item_id: str, title: str, price: int, url: str, image_url: str, ai_reason: str, target_name: str, specification: str = "", location: str = "", payment: str = "") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO parts_deals (id, title, price, url, image_url, ai_reason, target_name, specification, location, payment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, ai_reason, target_name, specification, location, payment))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"插入零件機商品失敗: {e}")
        return False

def get_parts_deals(limit: int = 50, target_name: Optional[str] = None, include_read: bool = False, specification: Optional[str] = None) -> List[Dict[str, Any]]:
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
