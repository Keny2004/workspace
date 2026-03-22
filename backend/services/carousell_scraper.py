import requests
import re
import json
from typing import List, Dict, Any, Optional
from .scraper_base import BaseScraper
from .proxy_service import ProxyService

class CarousellScraper(BaseScraper):
    def __init__(self):
        self.base_url = "https://tw.carousell.com"
        self.search_api = "https://tw.carousell.com/ds/filter/cf/4.0/search/?_path=%2Fcf%2F4.0%2Fsearch%2F&l=zh-Hant-TW"
        self.session = requests.Session()
        self.proxy_service = ProxyService()
        self.current_proxy = None
        self.ua_pool = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
        ]
        self._set_random_headers()

    def _set_random_headers(self):
        import random
        ua = random.choice(self.ua_pool)
        
        # Determine platform for Sec-CH-UA
        platform = "Windows"
        if "Macintosh" in ua: platform = "macOS"
        elif "iPhone" in ua: platform = "iOS"
        elif "Linux" in ua: platform = "Linux"

        self.session.headers.update({
            "User-Agent": ua,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Origin": "https://tw.carousell.com",
            "Referer": "https://tw.carousell.com/",
            "Sec-Ch-Ua-Platform": f"\"{platform}\"",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        })

    def warm_up(self, proxies: Optional[dict] = None):
        """Simulate a human visiting the home page to get valid session context"""
        try:
            self._set_random_headers()
            self.session.get(self.base_url, timeout=15, proxies=proxies)
            # Small delay after home page visit
            import time, random
            time.sleep(random.uniform(2, 4))
            return True
        except Exception as e:
            print(f"Warm-up failed: {e}")
            return False

    @property
    def platform_name(self) -> str:
        return "Carousell"

    def _get_csrf_token(self, proxies: Optional[dict] = None) -> Optional[str]:
        p_display = self.current_proxy if self.current_proxy else "Direct IP"
        try:
            print(f"Attempting to get CSRF token with {p_display}...")
            response = self.session.get(self.base_url, proxies=proxies, timeout=15)
            
            if response.status_code == 403:
                print(f"403 Forbidden detected on {p_display} during CSRF check.")
                if not self.current_proxy:
                    self.block_direct_ip = True
                self.session.cookies.clear()
                self.current_proxy = self.proxy_service.get_working_proxy()
                return None # Trigger retry in search loop
                
            csrf_token = self.session.cookies.get("_csrf")
            if not csrf_token:
                match = re.search(r'"csrfToken":"([^"]+)"', response.text)
                if match: csrf_token = match.group(1)
            return csrf_token
        except Exception as e:
            print(f"Error getting CSRF token: {e}")
            return None

    def search(self, query: str, count: int = 48) -> List[Dict[str, Any]]:
        payload = {
            "bestMatchEnabled": True,
            "canChangeKeyword": False,
            "count": count,
            "countryCode": "TW",
            "countryId": "1668284",
            "filters": [],
            "includeBpEducationBanner": True,
            "includeListingDescription": True, 
            "includePopularLocations": False,
            "includeSuggestions": True,
            "isCertifiedSpotlightEnabled": False,
            "locale": "zh-Hant-TW",
            "prefill": {},
            "query": query
        }

        import time
        import random
        
        max_attempts = 3
        # Ensure block_direct_ip persists if not initialized
        if not hasattr(self, 'block_direct_ip'):
            self.block_direct_ip = False
        
        for attempt in range(1, max_attempts + 1):
            if (not self.current_proxy) and self.block_direct_ip:
                print("Direct IP is blocked. Forcing proxy usage...")
                self.current_proxy = self.proxy_service.get_working_proxy()
            
            proxies = None
            if self.current_proxy:
                proxies = {"http": f"http://{self.current_proxy}", "https": f"http://{self.current_proxy}"}
            
            p_display = self.current_proxy if self.current_proxy else "Direct IP"
            print(f"Attempt {attempt}/{max_attempts} for {query} using {p_display}...")

            try:
                # Shorter human-like jitter: 3-7 seconds
                wait_time = random.uniform(3.0, 7.0)
                print(f"Human-like jitter: Waiting {wait_time:.1f}s before request...")
                time.sleep(wait_time)

                if not self.session.cookies.get("_csrf") or attempt > 1:
                     self.warm_up(proxies=proxies)
                
                csrf_token = self._get_csrf_token(proxies=proxies)
                if not csrf_token:
                    # If CSRF failed (likely 403), retry within the loop
                    print("CSRF retrieval failed. Retrying with new proxy...")
                    self.current_proxy = self.proxy_service.get_working_proxy()
                    continue

                if csrf_token:
                    self.session.headers.update({
                        "csrf-token": csrf_token,
                        "Content-Type": "application/json"
                    })

                response = self.session.post(self.search_api, json=payload, timeout=20, proxies=proxies)
                last_status = response.status_code
                
                if response.status_code == 403:
                    print(f"403 Forbidden detected on {p_display}. Rotating...")
                    if not self.current_proxy:
                        self.block_direct_ip = True
                    self.session.cookies.clear()
                    self.current_proxy = self.proxy_service.get_working_proxy()
                    continue

                if response.status_code == 502:
                    print(f"502 detected on {p_display}. Rotating...")
                    self.current_proxy = self.proxy_service.get_working_proxy()
                    continue
                
                response.raise_for_status()
                results_data = response.json()
                break 
                
            except Exception as e:
                print(f"Attempt {attempt} failed on {p_display}: {e}")
                self.current_proxy = self.proxy_service.get_working_proxy()
                if attempt == max_attempts:
                    if last_status == 403: raise Exception("PERSISTENT_403")
                    if last_status == 502: raise Exception("PERSISTENT_502")
                    return []
                continue
        
        if not results_data:
            return []

        try:
            results = results_data.get("data", {}).get("results", [])
            standardized_results = []
            
            thirty_days_ago = time.time() - (30 * 24 * 60 * 60)

            for item in results:
                card = item.get("listingCard", {})
                if not card: continue
                
                # Date Filtering: Only products within one month
                # Carousell Card often has 'secondsSinceEpoch' or similar in meta
                listing_time = card.get("secondsSinceEpoch") or card.get("timePassed")
                if listing_time and isinstance(listing_time, (int, float)):
                    # If it's status time, it might be seconds since epoch
                    if listing_time < thirty_days_ago and listing_time > 1000000000: # Simple epoch check
                        continue

                description = ""
                below_fold = card.get("belowFold", [])
                for component in below_fold:
                    if component.get("component") == "paragraph":
                        description = component.get("stringContent", "")
                        break

                price_str = card.get("price", "0").replace("NT$", "").replace(",", "").strip()
                try:
                    price = float(price_str)
                except:
                    price = 0.0

                standardized_results.append({
                    "external_id": str(card.get("id")),
                    "title": card.get("title"),
                    "description": description,
                    "price": price,
                    "url": f"{self.base_url}/p/{card.get('id')}",
                    "image_url": card.get("photoUrls", [None])[0]
                })
            return standardized_results
        except Exception as e:
            print(f"Search failed for {query}: {e}")
            return []
