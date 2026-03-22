from curl_cffi import requests
from bs4 import BeautifulSoup
import re
import time
import random
import urllib.parse
import json
from typing import List, Dict, Any, Optional
from .scraper_base import BaseScraper

class CarousellScraper(BaseScraper):
    def __init__(self):
        self.base_url = "https://tw.carousell.com"
        self.user_agents = ["chrome120"]
        self.session = requests.Session(impersonate="chrome120")
        
    @property
    def platform_name(self) -> str:
        return "Carousell"

    def search(self, query: str, count: int = 48) -> List[Dict[str, Any]]:
        """
        利用 curl_cffi 繞過 Cloudflare 防護，抓取旋轉拍賣商品列表 (HTML 解析版)
        """
        encoded_keyword = urllib.parse.quote(query, safe='')
        # sort_by=3 代表最新
        url = f"{self.base_url}/search/{encoded_keyword}?sort_by=3"
        
        print(f"Searching Carousell (HTML) for '{query}': {url}")
        
        # 隨機延遲
        time.sleep(random.uniform(3.0, 7.0))
        
        try:
            # 隨機選擇模擬身份
            impersonate = random.choice(self.user_agents)
            response = self.session.get(url, impersonate=impersonate, timeout=20)
            
            if response.status_code == 403:
                print(f"403 Forbidden on Carousell HTML search. Triggering backoff...")
                raise RuntimeError("FORBIDDEN_403")
                
            response.raise_for_status()
        except RuntimeError as re_err:
            if str(re_err) == "FORBIDDEN_403":
                raise re_err
            print(f"Carousell search failed: {re_err}")
            return []
        except Exception as e:
            print(f"Carousell search failed: {e}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 尋找所有商品區塊 (使用使用者提供的精準 Regex)
        product_cards = soup.find_all('div', attrs={'data-testid': re.compile(r'^listing-card-')})
        
        items = []
        thirty_days_ago = time.time() - (30 * 24 * 60 * 60)
        
        for card in product_cards:
            try:
                # 抓取連結
                product_link = card.find('a', href=re.compile(r'^/p/'))
                if not product_link:
                    product_link = card.find('a', href=True)
                    if not product_link: continue
                
                relative_url = product_link.get('href')
                full_url = f"{self.base_url}{relative_url}"
                
                # 抓取標題 (優先從 img alt/title，其次從 P 標籤)
                img_tag = card.find('img')
                title = "無標題"
                if img_tag and (img_tag.get('title') or img_tag.get('alt')):
                    title = img_tag.get('title') or img_tag.get('alt')
                else:
                    title_p = card.find('p', style=re.compile(r'-webkit-line-clamp:\s*2'))
                    if title_p:
                        title = title_p.text.strip()
                
                # 抓取圖片
                image_url = img_tag.get('src') if img_tag else ""
                
                # 抓取價格
                price_p = card.find('p', string=re.compile(r'NT\$'))
                price_str = price_p.text.strip() if price_p else "NT$ 0"
                price = float(re.sub(r'[^\d]', '', price_str))
                
                # 抓取時間 (判斷是否為 30 天內)
                time_node = card.find('p', string=re.compile(r'(分鐘|小時|天|剛剛|昨天|個月)'))
                time_str = time_node.text.strip() if time_node else ""
                
                # 過濾超過 1 個月的
                if "個月" in time_str:
                    try:
                        match = re.search(r'(\d+)', time_str)
                        if match:
                            months = int(match.group(1))
                            if months > 1: continue
                    except: pass
                
                # 如果是具體日期 (例如 1月12日) 且不包含 "前" 字樣，通常代表比較久以前的物件
                if "月" in time_str and "前" not in time_str:
                    # 簡單判斷：如果包含 "月" 但不是 "XX個月前"，可能是具體日期，通常比較舊
                    continue

                # 提取商品ID
                url_parts = relative_url.split('/')
                parts_filtered = [p for p in url_parts if p]
                item_id = ""
                if len(parts_filtered) > 1:
                    id_match = re.search(r'-(\d+)\/?$', parts_filtered[1])
                    if id_match:
                        item_id = id_match.group(1)
                
                if not item_id:
                    item_id = str(hash(full_url))
                    
                items.append({
                    "external_id": item_id,
                    "title": title,
                    "price": price,
                    "url": full_url,
                    "image_url": image_url,
                    "description": "" 
                })
            except Exception as e:
                continue
                
        print(f"Successfully scraped {len(items)} items from Carousell (Keyword: {query})")
        return items

    def get_item_details(self, url: str) -> Dict[str, Any]:
        """
        抓取商品詳情頁，從 initialState JSON 中獲取精確描述、狀況、地點等
        """
        print(f"Fetching details from Carousell: {url}")
        time.sleep(random.uniform(2.0, 4.0))
        
        try:
            response = self.session.get(url, impersonate=random.choice(self.user_agents), timeout=20)
            response.raise_for_status()
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract via initialState JSON (more robust than DOM)
            item_data = {}
            for script in soup.find_all('script'):
                if script.string and ('"listingCard"' in script.string or 'initialState' in script.string):
                    content = script.string.strip()
                    # Try to find JSON block
                    match = re.search(r'({.*})', content)
                    if match:
                        try:
                            item_data = json.loads(match.group(1))
                            break
                        except: continue

            # Recursive search for listing details in JSON
            def find_listing(obj):
                if isinstance(obj, dict):
                    if 'id' in obj and 'description' in obj and 'condition' in obj:
                        return obj
                    for v in obj.values():
                        res = find_listing(v)
                        if res: return res
                elif isinstance(obj, list):
                    for v in obj:
                        res = find_listing(v)
                        if res: return res
                return None

            listing = find_listing(item_data)
            
            if listing:
                # Map condition code
                cond_map = {
                    "1": "全新",
                    "2": "幾乎全新",
                    "3": "狀況良好",
                    "4": "輕微使用痕跡",
                    "5": "明顯使用痕跡",
                    "6": "損壞/零件機"
                }
                raw_cond = str(listing.get('condition', ''))
                
                return {
                    "description": listing.get('description', ''),
                    "status": cond_map.get(raw_cond, raw_cond if raw_cond else "未知"),
                    "transaction": listing.get('sourceDisplayValue', ''), # This often has pickup info
                    "posted_at": listing.get('timeDiff', ''),
                    "location": listing.get('locationName', '')
                }
            
            # Fallback to Regex for description if JSON fail
            desc_match = re.search(r'"description":"(.*?)"', html)
            description = desc_match.group(1).encode().decode('unicode_escape') if desc_match else ""
            
            return {
                "description": description,
                "status": "未知",
                "transaction": "",
                "posted_at": "",
                "location": ""
            }

        except Exception as e:
            print(f"Failed to fetch details for {url}: {e}")
            return {}