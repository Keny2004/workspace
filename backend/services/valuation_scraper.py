import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any
from datetime import datetime

class ValuationScraper:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def scrape_dynamic_url(self, url: str) -> List[Dict[str, Any]]:
        """
        Dynamically determine the source and scrape the valuation URL.
        """
        if "us3c.com.tw" in url:
            return self.scrape_us3c(url)
        elif "sogo3cphone.com" in url:
            return self.scrape_sogo3c(url)
        else:
            print(f"Unsupported valuation domain for URL: {url}")
            return []

    def scrape_us3c(self, url: str) -> List[Dict[str, Any]]:
        """
        Scrape US3C valuation tables.
        Returns: [{"model": str, "specs": str, "price": float}]
        """
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            tables = soup.find_all('table')
            
            results = []
            for table in tables:
                rows = table.find_all('tr')
                for row in rows:
                    cols = row.find_all('td')
                    if not cols: continue # Skip header
                    
                    full_name = cols[0].get_text(strip=True)
                    price_str = cols[1].get_text(strip=True).replace(',', '').replace('$', '').replace('NT$', '')
                    
                    try:
                        price = float(price_str)
                    except ValueError:
                        continue # Skip "尚未回收" or other non-numeric strings
                    
                    # Basic parsing for "iPhone 16 Pro Max 256G" -> model: iPhone 16 Pro Max, specs: 256G
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
            print(f"US3C scrape failed for {url}: {e}")
            return []

    def scrape_sogo3c(self, url: str) -> List[Dict[str, Any]]:
        """
        Scrape Sogo3C valuation tables.
        """
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            table = soup.find('table')
            if not table: return []
            
            results = []
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['th', 'td'])
                if len(cols) < 2: continue # Skip if unexpected structure
                
                full_name = cols[0].get_text(separator=' ', strip=True) # e.g., "17-256g"
                if not full_name or full_name in ['機型-容量(型號)', 'ipad pro', '收價'] or '收價' in full_name:
                    continue
                
                price_cell = cols[1].get_text(separator=' ', strip=True)
                # Sogo3C text can contain multiple prices split by whitespace: e.g. "22200 23200(保固...)"
                price_match = re.search(r'(\d{4,6})', price_cell.replace(',', ''))
                if not price_match: continue
                
                price = float(price_match.group(1))
                
                # Check if it's MacBook style (3 columns) where price is in col 2
                if len(cols) >= 3 and cols[2].get_text(strip=True):
                    price_match = re.search(r'(\d{4,6})', cols[2].get_text(separator=' ', strip=True).replace(',', ''))
                    if price_match:
                        full_name = f"{cols[0].get_text(strip=True)} {cols[1].get_text(strip=True)}"
                        price = float(price_match.group(1))

                results.append({"model": full_name, "specs": "", "price": price})
            return results
        except Exception as e:
            print(f"Sogo3C scrape failed for {url}: {e}")
            return []
