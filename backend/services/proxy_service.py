import requests
import re
import random
import time
from typing import List, Optional
import logging

class ProxyService:
    def __init__(self):
        self.proxies = []
        self.last_fetch = 0
        self.fetch_interval = 1800 # 30 mins
        self.logger = logging.getLogger("ProxyService")
        self.test_url = "https://tw.carousell.com"

    def fetch_proxies(self) -> List[str]:
        """Fetch both manual and free proxies"""
        if time.time() - self.last_fetch < self.fetch_interval and self.proxies:
            return self.proxies

        from ..database import SessionLocal
        from ..models import SystemConfig
        db = SessionLocal()
        
        new_proxies = []
        try:
            # 1. Fetch Manual Custom Proxies (High Priority)
            conf = db.query(SystemConfig).filter(SystemConfig.key == "custom_proxies").first()
            if conf and conf.value:
                manual_list = [p.strip() for p in conf.value.split("\n") if p.strip()]
                new_proxies.extend(manual_list)
                self.logger.info(f"Loaded {len(manual_list)} custom proxies.")

            # 2. Fetch Free Proxies (Fallback)
            self.logger.info("Fetching fresh free proxy list...")
            
            # Source 1: free-proxy-list.net
            try:
                resp1 = requests.get("https://free-proxy-list.net/", timeout=10)
                matches1 = re.findall(r'\d+\.\d+\.\d+\.\d+:\d+', resp1.text)
                new_proxies.extend(matches1)
            except: pass

            # Source 2: proxyscrape.com
            try:
                resp2 = requests.get("https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all", timeout=10)
                matches2 = resp2.text.strip().split("\r\n")
                new_proxies.extend([m for m in matches2 if ":" in m])
            except: pass
            
        except Exception as e:
            self.logger.error(f"Failed to fetch proxies: {e}")
        finally:
            db.close()

        if new_proxies:
            self.proxies = list(set(new_proxies)) # Deduplicate
            self.last_fetch = time.time()
            self.logger.info(f"Total proxy pool: {len(self.proxies)} addresses.")
        
        return self.proxies

    def get_random_proxy(self) -> Optional[str]:
        if not self.proxies:
            self.fetch_proxies()
        
        if not self.proxies:
            return None
            
        return random.choice(self.proxies)

    def validate_proxy(self, proxy_addr: str) -> bool:
        """Quickly check if a proxy can reach Carousell"""
        proxies = {
            "http": f"http://{proxy_addr}",
            "https": f"http://{proxy_addr}"
        }
        try:
            # Use a short timeout and check if it's actually Carousell
            response = requests.get(self.test_url, proxies=proxies, timeout=5)
            # Ensure it's not a generic 200 from a bad proxy (captive portal, etc.)
            return response.status_code == 200 and "Carousell" in response.text
        except:
            return False

    def get_working_proxy(self, max_attempts: int = 5) -> Optional[str]:
        """Try up to N random proxies until one works"""
        for _ in range(max_attempts):
            p = self.get_random_proxy()
            if not p: break
            if self.validate_proxy(p):
                self.logger.info(f"Found working proxy: {p}")
                return p
            else:
                # Remove dead proxy from pool
                if p in self.proxies:
                    self.proxies.remove(p)
        return None
