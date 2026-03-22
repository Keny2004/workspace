from curl_cffi import requests  # 重點：統一使用 curl_cffi
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any
import time
import random
from typing import List, Dict, Any

class ValuationScraper:
    def __init__(self):
        # 捨棄了原本複雜的 _get_headers，改用統一的 session 引擎
        self.session = requests.Session(impersonate="chrome120")

    def scrape_dynamic_url(self, url: str) -> List[Dict[str, Any]]:
        # 進入網站前的隨機延遲
        time.sleep(random.uniform(2, 5))
        
        if "us3c.com.tw" in url:
            return self.scrape_us3c(url)
        elif "sogo3cphone.com" in url:
            return self.scrape_sogo3c(url)
        else:
            print(f"Unsupported valuation domain for URL: {url}")
            return []

    def _execute_request_with_retry(self, url: str, site_name: str, max_attempts: int = 3) -> str:
        """
        將「請求與重試機制」獨立抽出，避免程式碼重複
        """
        for attempt in range(1, max_attempts + 1):
            print(f"[{site_name}] Attempt {attempt}/{max_attempts} using direct IP...")
            
            try:
                response = self.session.get(url, timeout=15)
                if response.status_code == 403:
                    print(f"[{site_name}] 403 Forbidden on direct IP. Triggering backoff...")
                    raise RuntimeError("FORBIDDEN_403")
                
                response.raise_for_status()
                return response.text  # 成功就回傳 HTML 原始碼
            except RuntimeError as re_err:
                if str(re_err) == "FORBIDDEN_403":
                    raise re_err
                print(f"[{site_name}] Attempt {attempt} failed: {re_err}")
                time.sleep(random.uniform(2, 4))
            except Exception as e:
                print(f"[{site_name}] Attempt {attempt} failed: {e}")
                time.sleep(random.uniform(2, 4)) # 失敗後稍微等待再重試
                
        raise Exception(f"Failed to scrape {site_name} after {max_attempts} attempts.")

    def scrape_us3c(self, url: str) -> List[Dict[str, Any]]:
        try:
            html_text = self._execute_request_with_retry(url, "US3C")
            soup = BeautifulSoup(html_text, 'html.parser')
            tables = soup.find_all('table')
            
            results = []
            for table in tables:
                rows = table.find_all('tr')
                for row in rows:
                    cols = row.find_all('td')
                    if not cols: continue
                    
                    full_name = cols[0].get_text(strip=True)
                    price_str = cols[1].get_text(strip=True).replace(',', '').replace('$', '').replace('NT$', '')
                    
                    try:
                        price = float(price_str)
                    except ValueError:
                        continue
                    
                    # 匹配型號與容量
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
            print(f"US3C Fatal Error: {e}")
            return []

    def scrape_sogo3c(self, url: str) -> List[Dict[str, Any]]:
        try:
            html_text = self._execute_request_with_retry(url, "Sogo3C")
            soup = BeautifulSoup(html_text, 'html.parser')
            
            # Sogo3C 可能有多個 table，嘗試尋找產品列表 table
            # 通常產品列表 table 的 tr 較多
            tables = soup.find_all('table')
            if not tables:
                print(f"Sogo3C Warning: No tables found on {url}")
                return []
            
            # 找出最像產品列表的 table (tr 數量最多的)
            table = max(tables, key=lambda t: len(t.find_all('tr')))
            
            results = []
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['th', 'td'])
                if len(cols) < 2: continue
                
                full_name = cols[0].get_text(separator=' ', strip=True) 
                # 過濾表頭
                if not full_name or full_name in ['機型-容量(型號)', '收價'] or '收價' in full_name:
                    continue
                
                price_cell = cols[1].get_text(separator=' ', strip=True)
                # 強化價格提取：移除逗號與非數字字元，匹配 4 到 6 位數字
                clean_price_cell = re.sub(r'[^\d]', '', price_cell)
                price_match = re.search(r'(\d{3,6})', clean_price_cell) # 放寬到 3 位數以容納更低價產品
                if not price_match: continue
                
                price = float(price_match.group(1))
                
                # Sogo3C 的特殊表格結構處理 (部分欄位可能錯位)
                # 如果第三欄有內容且也是數字，可能是真正的價格
                if len(cols) >= 3:
                    c2_text = re.sub(r'[^\d]', '', cols[2].get_text(strip=True))
                    pm = re.search(r'(\d{3,6})', c2_text)
                    if pm:
                        # 如果第三欄有價格，則第一二欄合併為名稱
                        full_name = f"{cols[0].get_text(strip=True)} {cols[1].get_text(strip=True)}"
                        price = float(pm.group(1))

                results.append({"model": full_name, "specs": "", "price": price})
            
            if not results:
                print(f"Sogo3C Warning: No items parsed from {url}")
            return results
        except Exception as e:
            print(f"Sogo3C Fatal Error: {e}")
            return []