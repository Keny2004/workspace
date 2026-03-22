from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup
import re
import urllib.parse
import time
import random
import logging

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "chrome110", "edge99", "safari15_3"
]

def fetch_carousell_items(keyword: str, sort_by: str = "3", delay_range: tuple = (3, 8)):
    """
    利用 curl_cffi 繞過 Cloudflare 防護，抓取旋轉拍賣商品列表
    sort_by: 3=最新
    """
    encoded_keyword = urllib.parse.quote(keyword)
    url = f"https://tw.carousell.com/search/{encoded_keyword}?sort_by={sort_by}"
    
    logger.info(f"正在抓取列表網址: {url}")
    
    delay = random.uniform(delay_range[0], delay_range[1])
    time.sleep(delay)
    
    impersonate = random.choice(USER_AGENTS)
    
    try:
        response = cffi_requests.get(url, impersonate=impersonate, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"抓取旋轉拍賣列表失敗: {e}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 尋找所有商品區塊
    product_cards = soup.find_all('div', attrs={'data-testid': re.compile(r'^listing-card-')})
    
    items = []
    for card in product_cards:
        try:
            # 精準挑選商品連結 (排除賣家個人首頁連結)
            product_link = card.find('a', href=re.compile(r'^/p/'))
            if not product_link:
                # 備案：如果找不到帶 /p/ 的，再退而求其次找第一個有標題屬性的 a
                product_link = card.find('a', href=True)
                if not product_link: continue
            
            relative_url = product_link.get('href')
            full_url = f"https://tw.carousell.com{relative_url}"
            
            # 抓取圖片網址與堅固的標題
            img_tag = card.find('img')
            image_url = img_tag.get('src') if img_tag else ""
            
            title = "無標題"
            if img_tag and (img_tag.get('title') or img_tag.get('alt')):
                title = img_tag.get('title') or img_tag.get('alt')
            else:
                title_p = card.find('p', style=re.compile(r'-webkit-line-clamp:\s*2'))
                if title_p:
                    title = title_p.text.strip()
                elif len(card.find_all('p')) > 2:
                    title = card.find_all('p')[2].text.strip()
            
            # 抓取價格
            price_p = card.find('p', string=re.compile(r'NT\$'))
            price_str = price_p.text.strip() if price_p else "NT$ 0"
            price = int(re.sub(r'[^\d]', '', price_str))
            
            # 抓取上架時間
            time_node = card.find('p', string=re.compile(r'(分鐘|小時|天|剛剛|昨天)'))
            time_str = time_node.text.strip() if time_node else "未知"
            
            # 提取商品ID (從網址擷取)
            url_parts = relative_url.split('/')
            parts_filtered = [p for p in url_parts if p]
            # ID 通常在最後一個區段的結尾，例如 -123456789
            item_id = ""
            if len(parts_filtered) > 1:
                id_match = re.search(r'-(\d+)\/?$', parts_filtered[1])
                if id_match:
                    item_id = id_match.group(1)
            
            if not item_id:
                item_id = str(hash(full_url))
                
            items.append({
                "id": item_id,
                "title": title,
                "price": price,
                "url": full_url,
                "image_url": image_url,
                "time": time_str
            })
        except Exception as e:
            logger.debug(f"解析單一商品失敗，略過: {e}")
            continue
            
    logger.info(f"成功從旋轉拍賣抓取了 {len(items)} 筆商品 (關鍵字: {keyword})")
    return items

def fetch_item_details(url: str, delay_range: tuple = (2, 5)) -> str:
    """
    抓取特定商品的深層詳細頁面，取得完整描述文字。
    """
    logger.info(f"正在深層爬取商品詳細內文: {url}")
    delay = random.uniform(delay_range[0], delay_range[1])
    time.sleep(delay)
    
    impersonate = random.choice(USER_AGENTS)
    try:
        response = cffi_requests.get(url, impersonate=impersonate, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"深層抓取商品外連失敗 {url}: {e}")
        return ""
        
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 嘗試抓取旋轉拍賣的新版內文 div
    desc_node = soup.find('div', attrs={'data-testid': 'listing-page-text-description'})
    if desc_node:
        return desc_node.get_text('\n', strip=True)
    
    # 備案：大海撈針抓取 P 段落
    paragraphs = soup.find_all('p')
    # 備案：大海撈針抓取 P 段落
    paragraphs = soup.find_all('p')
    desc_lines = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20]
    return "\n".join(desc_lines)

def fetch_us3c_prices(url: str) -> Dict[str, int]:
    """
    抓取 US3C 回收價格 (通常以表格形式呈現)
    """
    logger.info(f"正在抓取 US3C 行情: {url}")
    try:
        response = cffi_requests.get(url, impersonate="chrome110", timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        results = {}
        # 尋找包含容量與價格的表格行
        rows = soup.find_all('tr')
        for row in rows:
            cols = row.find_all(['td', 'th'])
            if len(cols) >= 2:
                text = cols[0].get_text(strip=True)
                price_text = cols[-1].get_text(strip=True)
                
                # 提取容量 (如 128G, 256G)
                capacity_match = re.search(r'(\d+)\s*(GB|G|TB|T)', text, re.IGNORECASE)
                if capacity_match:
                    num, unit = capacity_match.groups()
                    cap = f"{num}{unit[0].upper()}"
                    
                    # 提取價格
                    price_match = re.search(r'[\d,]+', price_text)
                    if price_match:
                        price = int(re.sub(r'[^\d]', '', price_match.group()))
                        results[cap] = price
        return results
    except Exception as e:
        logger.error(f"抓取 US3C 失敗: {e}")
        return {}

def fetch_sogo3c_prices(url: str) -> Dict[str, int]:
    """
    抓取 SOGO3C 回收價格
    """
    logger.info(f"正在抓取 SOGO3C 行情: {url}")
    try:
        response = cffi_requests.get(url, impersonate="chrome110", timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        results = {}
        # SOGO3C 通常在商品詳情頁有規格按鈕與對應價格
        # 這裡根據常見 layout 抓取
        price_blocks = soup.find_all(['div', 'li'], class_=re.compile(r'price|spec|item', re.I))
        for block in price_blocks:
            text = block.get_text(strip=True)
            capacity_match = re.search(r'(\d+)\s*(GB|G|TB|T)', text, re.IGNORECASE)
            price_match = re.search(r'[\d,]+', text)
            if capacity_match and price_match:
                num, unit = capacity_match.groups()
                cap = f"{num}{unit[0].upper()}"
                price = int(re.sub(r'[^\d]', '', price_match.group()))
                # 簡單過濾一下避免誤讀
                if price > 1000:
                    results[cap] = price
        
        # 如果上面抓不到，嘗試找 table
        if not results:
            for tr in soup.find_all('tr'):
                tds = tr.find_all('td')
                if len(tds) >= 2:
                    t1, t2 = tds[0].text, tds[-1].text
                    c_m = re.search(r'(\d+)\s*(GB|G|TB|T)', t1, re.I)
                    p_m = re.search(r'[\d,]+', t2)
                    if c_m and p_m:
                        results[f"{c_m.group(1)}{c_m.group(2)[0].upper()}"] = int(re.sub(r'[^\d]', '', p_m.group()))
                        
        return results
    except Exception as e:
        logger.error(f"抓取 SOGO3C 失敗: {e}")
        return {}
