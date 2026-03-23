from curl_cffi import requests
from bs4 import BeautifulSoup
import re
import time
import random
import urllib.parse
import json
import hashlib
from typing import List, Dict, Any, Optional
from .scraper_base import BaseScraper


class YahooScraper(BaseScraper):
    def __init__(self):
        self.base_url = "https://tw.bid.yahoo.com"
        self.session = requests.Session(impersonate="chrome120")

    @property
    def platform_name(self) -> str:
        return "Yahoo Auction"

    def search(self, query: str, **kwargs) -> List[Dict[str, Any]]:
        """
        搜尋 Yahoo 奇摩拍賣二手商品
        URL: https://tw.bid.yahoo.com/search/auction/product
        核心參數: p=query, has_used=1 (僅二手), s=-ctime (最新上架)
        """
        url = f"{self.base_url}/search/auction/product"
        params = {
            "p": query,
            "has_used": "1",    # 核心：只顯示二手
            "s": "-ctime",       # 最新上架優先
        }

        print(f"Searching Yahoo Auction for '{query}': {url}?{urllib.parse.urlencode(params)}")

        # 隨機延遲 5~15 秒
        delay = random.uniform(5, 15)
        print(f"  Sleeping {delay:.1f}s before request...")
        time.sleep(delay)

        try:
            response = self.session.get(
                url,
                params=params,
                impersonate="chrome120",
                timeout=20
            )

            if response.status_code == 403:
                print(f"403 Forbidden on Yahoo Auction search. Triggering backoff...")
                raise RuntimeError("FORBIDDEN_403")

            response.raise_for_status()
        except RuntimeError as re_err:
            if str(re_err) == "FORBIDDEN_403":
                raise re_err
            print(f"Yahoo Auction search failed: {re_err}")
            return []
        except Exception as e:
            print(f"Yahoo Auction search failed: {e}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        items = self._parse_search_results(soup)

        print(f"Successfully scraped {len(items)} items from Yahoo Auction (Keyword: {query})")
        return items

    def _parse_search_results(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        解析搜尋結果頁面。
        主策略：從 <script> 內嵌 JSON 中提取 ecsearch.hits
        備用策略：HTML DOM 解析 gridList
        """
        items = []

        # === 主策略: 從內嵌 JSON 提取 (最穩定、資料最完整) ===
        items = self._extract_from_embedded_json(soup)
        if items:
            return items

        # === 備用策略: HTML DOM 解析 ===
        items = self._extract_from_html(soup)
        return items

    def _extract_from_embedded_json(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        從頁面內嵌的大型 JSON <script> 中提取商品資料。
        路徑: data['search']['ecsearch']['hits']
        每個 hit 的欄位使用 ec_ 前綴，如 ec_title, ec_price, ec_item_url 等。
        """
        items = []

        for script in soup.find_all('script'):
            text = script.string
            if not text or len(text) < 5000:
                continue

            # 尋找包含 ecsearch 的大型 JSON
            if '"ecsearch"' not in text:
                continue

            try:
                data = json.loads(text)
            except (json.JSONDecodeError, Exception):
                # 嘗試用 regex 提取 JSON 物件
                try:
                    json_match = re.search(r'^({.*})$', text, re.DOTALL)
                    if json_match:
                        data = json.loads(json_match.group(1))
                    else:
                        continue
                except Exception:
                    continue

            # 導航到 hits
            try:
                ecsearch = data.get('search', {}).get('ecsearch', {})
                hits = ecsearch.get('hits', [])
            except Exception:
                continue

            if not isinstance(hits, list) or not hits:
                continue

            for hit in hits:
                try:
                    # 跳過廣告 (ec_is_dynamic_ad)
                    if hit.get('ec_is_dynamic_ad') is True:
                        continue

                    title = hit.get('ec_title', '')
                    if not title or len(title) < 3:
                        continue

                    # 跳過含「贊助」字樣
                    if '贊助' in title or '廣告' in title:
                        continue

                    # 價格
                    raw_price = hit.get('ec_price') or hit.get('ec_buyprice') or hit.get('ec_listprice', 0)
                    try:
                        price = float(str(raw_price).replace(',', '').replace('$', ''))
                    except (ValueError, TypeError):
                        continue
                    if price <= 0:
                        continue

                    # URL
                    item_url = hit.get('ec_item_url', '')
                    if not item_url:
                        product_id = hit.get('ec_productid', '')
                        if product_id:
                            item_url = f"{self.base_url}/item/{product_id}"
                        else:
                            continue

                    # External ID (商品唯一編號)
                    external_id = str(hit.get('ec_productid', ''))
                    if not external_id:
                        id_match = re.search(r'/item/(\d+)', item_url)
                        external_id = id_match.group(1) if id_match else hashlib.md5(item_url.encode()).hexdigest()[:16]

                    # 圖片
                    image_url = hit.get('ec_image', '')
                    # 清除 URL 後的尺寸標記 (如 #320x320)
                    if image_url and '#' in image_url:
                        image_url = image_url.split('#')[0]

                    items.append({
                        "external_id": external_id,
                        "title": title,
                        "price": price,
                        "url": item_url,
                        "image_url": image_url,
                        "description": (hit.get('ec_description', '') or '')[:500]
                    })
                except Exception:
                    continue

            if items:
                return items

        return []

    def _extract_from_html(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        備用策略：從 HTML DOM 的 gridList 容器中解析商品卡片
        """
        items = []

        # 尋找 gridList <ul>
        grid = soup.find('ul', class_='gridList')
        if not grid:
            # Fallback: 找到含有最多 <li> 的 <ul>（帶商品連結的）
            all_uls = soup.find_all('ul')
            for ul in all_uls:
                lis = ul.find_all('li', recursive=False)
                if len(lis) > 10:
                    # 檢查是否含有商品連結
                    first_item_link = ul.find('a', href=re.compile(r'/item/\d+'))
                    if first_item_link:
                        grid = ul
                        break

        if not grid:
            return []

        card_items = grid.find_all('li', recursive=False)

        for card in card_items:
            try:
                card_text = card.get_text()

                # 跳過贊助廣告
                if '贊助' in card_text or 'Sponsored' in card_text or '廣告' in card_text:
                    continue

                # 提取連結
                link = card.find('a', href=re.compile(r'/item/\d+'))
                if not link:
                    link = card.find('a', href=True)
                    if not link:
                        continue

                href = link.get('href', '')
                if href.startswith('/'):
                    full_url = f"{self.base_url}{href}"
                elif href.startswith('http'):
                    full_url = href
                else:
                    continue

                # 跳過非商品連結 (如 booth/search)
                if '/item/' not in full_url:
                    continue

                # 提取標題
                title = ''
                # 從圖片 alt/title
                img_tag = card.find('img')
                if img_tag:
                    title = img_tag.get('alt') or img_tag.get('title') or ''
                # 從文字標籤
                if not title or len(title) < 3:
                    title_el = card.find(['h2', 'h3', 'h4', 'span', 'a'], string=re.compile(r'.{5,}'))
                    if title_el:
                        title = title_el.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # 提取價格
                price = self._extract_price_from_card(card)
                if price is None or price <= 0:
                    continue

                # 提取圖片
                image_url = ''
                if img_tag:
                    image_url = img_tag.get('src') or img_tag.get('data-src') or ''

                # 提取 external_id
                id_match = re.search(r'/item/(\d+)', full_url)
                external_id = id_match.group(1) if id_match else hashlib.md5(full_url.encode()).hexdigest()[:16]

                items.append({
                    "external_id": external_id,
                    "title": title,
                    "price": price,
                    "url": full_url,
                    "image_url": image_url,
                    "description": ""
                })
            except Exception:
                continue

        return items

    def _extract_price_from_card(self, card) -> Optional[float]:
        """從商品卡片中提取價格"""
        price_patterns = [
            re.compile(r'NT\$?\s*[\d,]+'),
            re.compile(r'\$\s*[\d,]+'),
            re.compile(r'[\d,]+\s*元'),
        ]

        # 嘗試含 price class 的元素
        price_el = card.find(['span', 'div', 'p', 'em'], class_=re.compile(r'(price|cost|amount)', re.I))
        if price_el:
            cleaned = re.sub(r'[^\d]', '', price_el.get_text(strip=True))
            if cleaned:
                return float(cleaned)

        # 嘗試正則匹配
        all_texts = card.find_all(string=True)
        for text in all_texts:
            text = text.strip()
            for pattern in price_patterns:
                match = pattern.search(text)
                if match:
                    cleaned = re.sub(r'[^\d]', '', match.group())
                    if cleaned and float(cleaned) > 10:
                        return float(cleaned)

        return None

    def get_item_details(self, url: str) -> Dict[str, Any]:
        """
        抓取 Yahoo 奇摩拍賣商品詳情頁，提取描述、狀態、地點等
        """
        print(f"Fetching details from Yahoo Auction: {url}")
        time.sleep(random.uniform(5, 15))

        try:
            response = self.session.get(url, impersonate="chrome120", timeout=20)
            response.raise_for_status()
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')

            # === 策略 1: 從內嵌 JSON 提取詳情 ===
            for script in soup.find_all('script'):
                text = script.string
                if not text or len(text) < 1000:
                    continue
                if 'ec_description' in text or 'description' in text:
                    try:
                        data = json.loads(text)
                        desc = self._find_in_json(data, 'ec_description') or self._find_in_json(data, 'description')
                        location = self._find_in_json(data, 'ec_location') or self._find_in_json(data, 'location')
                        condition = self._find_in_json(data, 'ec_property') or ''

                        # 對應物品狀態
                        cond_map = {
                            '1': '全新',
                            '2': '近全新',
                            '3': '二手',
                            '4': '瑕疵品',
                        }

                        if desc:
                            return {
                                "description": desc[:1000] if isinstance(desc, str) else str(desc)[:1000],
                                "status": cond_map.get(str(condition), "二手"),
                                "transaction": "",
                                "posted_at": "",
                                "location": location if isinstance(location, str) else ""
                            }
                    except (json.JSONDecodeError, Exception):
                        continue

            # === 策略 2: HTML 解析 ===
            description = ""

            # 商品描述區塊
            desc_el = soup.find(['div', 'section'], class_=re.compile(r'(description|detail|content|info)', re.I))
            if desc_el:
                description = desc_el.get_text(separator='\n', strip=True)[:1000]

            # Fallback: meta description
            if not description:
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc:
                    description = meta_desc.get('content', '')

            return {
                "description": description,
                "status": "二手",
                "transaction": "",
                "posted_at": "",
                "location": ""
            }

        except Exception as e:
            print(f"Failed to fetch Yahoo Auction details for {url}: {e}")
            return {}

    def _find_in_json(self, data, key, depth=0):
        """遞迴在巢狀 JSON 中搜尋指定 key 的值"""
        if depth > 8:
            return None
        if isinstance(data, dict):
            if key in data:
                return data[key]
            for v in data.values():
                result = self._find_in_json(v, key, depth + 1)
                if result:
                    return result
        elif isinstance(data, list):
            for v in data:
                result = self._find_in_json(v, key, depth + 1)
                if result:
                    return result
        return None
