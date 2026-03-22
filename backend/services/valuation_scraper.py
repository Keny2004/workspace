import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any
from datetime import datetime

import time
import random
from .proxy_service import ProxyService

class ValuationScraper:
    def __init__(self):
        self.proxy_service = ProxyService()
        self.ua_pool = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
        ]

    def _get_headers(self, url=""):
        import random
        ua = random.choice(self.ua_pool)
        
        # Determine platform for Sec-CH-UA
        platform = "Windows"
        if "Macintosh" in ua: platform = "macOS"
        elif "iPhone" in ua: platform = "iOS"
        
        headers = {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Ch-Ua-Platform": f"\"{platform}\"",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0"
        }
        if url:
            headers["Referer"] = url
        return headers

    def scrape_dynamic_url(self, url: str) -> List[Dict[str, Any]]:
        # Add a random initial delay
        time.sleep(random.uniform(2, 5))
        
        if "us3c.com.tw" in url:
            return self.scrape_us3c(url)
        elif "sogo3cphone.com" in url:
            return self.scrape_sogo3c(url)
        else:
            print(f"Unsupported valuation domain for URL: {url}")
            return []

    def scrape_us3c(self, url: str) -> List[Dict[str, Any]]:
        proxy_addr = self.proxy_service.get_working_proxy()
        proxies = {"http": f"http://{proxy_addr}", "https": f"http://{proxy_addr}"} if proxy_addr else None
        
        try:
            print(f"Scraping US3C with {'proxy ' + proxy_addr if proxy_addr else 'direct IP'}...")
            response = requests.get(url, headers=self._get_headers(url), proxies=proxies, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            tables = soup.find_all('table')
            
            results = []
            for table in tables:
                rows = table.find_all('tr')
                for row in rows:
                    # Minor jitter between rows if needed, but per-site is usually enough
                    cols = row.find_all('td')
                    if not cols: continue
                    
                    full_name = cols[0].get_text(strip=True)
                    price_str = cols[1].get_text(strip=True).replace(',', '').replace('$', '').replace('NT$', '')
                    
                    try:
                        price = float(price_str)
                    except ValueError:
                        continue
                    
                    match = re.search(r'(.+)\s+(\d+[G|T])', full_name)
                    if match:
                        model = match.group(1).strip()
                        specs = match.group(2).strip()
                    else:
                        model = full_name
                        specs = ""

                    results.append({"model": model, "specs": specs, "price": price})
            return results
        except Exception as e:
            print(f"US3C scrape failed: {e}")
            return []

    def scrape_sogo3c(self, url: str) -> List[Dict[str, Any]]:
        proxy_addr = self.proxy_service.get_working_proxy()
        proxies = {"http": f"http://{proxy_addr}", "https": f"http://{proxy_addr}"} if proxy_addr else None

        try:
            print(f"Scraping Sogo3C with {'proxy ' + proxy_addr if proxy_addr else 'direct IP'}...")
            response = requests.get(url, headers=self._get_headers(), proxies=proxies, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            table = soup.find('table')
            if not table: return []
            
            results = []
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['th', 'td'])
                if len(cols) < 2: continue
                
                full_name = cols[0].get_text(separator=' ', strip=True) 
                if not full_name or full_name in ['機型-容量(型號)', 'ipad pro', '收價'] or '收價' in full_name:
                    continue
                
                price_cell = cols[1].get_text(separator=' ', strip=True)
                price_match = re.search(r'(\d{4,6})', price_cell.replace(',', ''))
                if not price_match: continue
                
                price = float(price_match.group(1))
                
                if len(cols) >= 3 and cols[2].get_text(strip=True):
                    pm = re.search(r'(\d{4,6})', cols[2].get_text(separator=' ', strip=True).replace(',', ''))
                    if pm:
                        full_name = f"{cols[0].get_text(strip=True)} {cols[1].get_text(strip=True)}"
                        price = float(pm.group(1))

                results.append({"model": full_name, "specs": "", "price": price})
            return results
        except Exception as e:
            print(f"Sogo3C scrape failed: {e}")
            return []
