import sqlite3
import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("DB_PATH", "data/carousell.db")

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return sqlite3.connect(DB_PATH)

def init_db():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    image_url TEXT,
                    time TEXT NOT NULL,
                    status TEXT NOT NULL, -- 'Normal Deal', 'Great Deal', 'Special'
                    is_notified INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    target_name TEXT DEFAULT ''
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS profitable_deals (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    image_url TEXT,
                    ai_reason TEXT NOT NULL,
                    target_name TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

def item_exists(item_id: str) -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM items WHERE id = ?", (item_id,))
            return cursor.fetchone() is not None
    except Exception as e:
        logger.error(f"Error checking if item exists: {e}")
        return False

def insert_item(item_id: str, title: str, price: int, url: str, image_url: str, time_str: str, status: str, is_notified: int = 0, target_name: str = "") -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO items (id, title, price, url, image_url, time, status, is_notified, target_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, time_str, status, is_notified, target_name))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False # Already exists
    except Exception as e:
        logger.error(f"Error inserting item: {e}")
        return False

def get_items(limit: int = 50, status_filter: Optional[str] = None, target_name: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM items WHERE 1=1"
            params = []
            if status_filter:
                query += " AND status = ?"
                params.append(status_filter)
            if target_name:
                query += " AND target_name = ?"
                params.append(target_name)
                
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching items: {e}")
        return []

def deal_exists(item_id: str) -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM profitable_deals WHERE id = ?", (item_id,))
            return cursor.fetchone() is not None
    except Exception:
        return False

def insert_profitable_deal(item_id: str, title: str, price: int, url: str, image_url: str, ai_reason: str, target_name: str) -> bool:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO profitable_deals (id, title, price, url, image_url, ai_reason, target_name)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (item_id, title, price, url, image_url, ai_reason, target_name))
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        logger.error(f"Error inserting deal: {e}")
        return False

def get_profitable_deals(limit: int = 50, target_name: Optional[str] = None) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM profitable_deals WHERE 1=1"
            params = []
            if target_name:
                query += " AND target_name = ?"
                params.append(target_name)
            
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching deals: {e}")
        return []

def mark_as_notified(item_id: str):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE items SET is_notified = 1 WHERE id = ?", (item_id,))
            conn.commit()
    except Exception as e:
        logger.error(f"Error updating item notification status: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
