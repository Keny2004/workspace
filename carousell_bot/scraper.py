import logging
from bs4 import BeautifulSoup
from curl_cffi import requests
from urllib.parse import quote
import random
import time
import re
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "chrome110", "chrome104", "edge101", "safari15_3", "safari15_5", "chrome120"
]

def fetch_carousell_items(keyword: str, sort_by: str = "3", delay_range: tuple = (3, 8)) -> List[Dict[str, Any]]:
    url = f"https://tw.carousell.com/search/{quote(keyword)}?sort_by={sort_by}"
    logger.info(f"Fetching Carousell url: {url}")
    
    # Anti-bot delay
    delay = random.uniform(delay_range[0], delay_range[1])
    logger.debug(f"Sleeping for {delay:.2f} seconds...")
    time.sleep(delay)
    
    impersonate = random.choice(USER_AGENTS)
    try:
        response = requests.get(url, impersonate=impersonate, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Error fetching data from Carousell: {e}")
        return []
        
    soup = BeautifulSoup(response.text, 'html.parser')
    cards = soup.find_all('a', href=re.compile(r'^/p/.*'))
    
    items = []
    for card in cards:
        href = card.get('href')
        if not href: continue
        
        # Extract ID
        match = re.search(r'-(\d+)/\?', href) or re.search(r'-(\d+)/?$', href)
        if not match:
            continue
        item_id = match.group(1)
            
        full_url = f"https://tw.carousell.com{href}"
        
        # The text structure typically is Name \n Price \n Condition ...
        texts = list(card.stripped_strings)
        if len(texts) < 2:
            continue
            
        title = texts[0]
        price_str = ""
        for t in texts:
            if 'NT$' in t:
                price_str = t
                break
                
        if not price_str:
            continue
            
        try:
            price = int(re.sub(r'[^\d]', '', price_str))
        except ValueError:
            price = 0
            
        # Try extracting image
        img_tag = card.find('img')
        image_url = img_tag.get('src') if img_tag else ""
        
        # In Taiwan Carousell search, time is not always visible on card, set to newest
        items.append({
            "id": str(item_id),
            "title": title,
            "price": price,
            "url": full_url,
            "image_url": image_url,
            "description": "", # Details require fetching individual page
            "time": "剛剛" # Approximate for newest sorting
        })
        
    logger.info(f"Scraped {len(items)} items from Carousell")
    return items

def fetch_item_details(url: str, delay_range: tuple = (2, 5)) -> str:
    """
    Fetches the specific item page and extracts its full description.
    """
    logger.info(f"Deep scraping details for: {url}")
    delay = random.uniform(delay_range[0], delay_range[1])
    time.sleep(delay)
    
    impersonate = random.choice(USER_AGENTS)
    try:
        response = requests.get(url, impersonate=impersonate, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Error fetching item details {url}: {e}")
        return ""
        
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Attempt to locate Carousell's description specific div
    desc_node = soup.find('div', attrs={'data-testid': 'listing-page-text-description'})
    if desc_node:
        return desc_node.get_text('\n', strip=True)
    
    # Fallback: search across all paragraphs
    paragraphs = soup.find_all('p')
    # Filter short paragraphs that are likely UI text
    desc_lines = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20]
    return "\n".join(desc_lines)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    items = fetch_carousell_items("iPhone 14 Pro 128G")
    for item in items[:3]:
        print(item)
