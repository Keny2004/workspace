import requests
import re
import json
from typing import List, Dict, Any, Optional
from .scraper_base import BaseScraper

class CarousellScraper(BaseScraper):
    def __init__(self):
        self.base_url = "https://tw.carousell.com"
        self.search_api = "https://tw.carousell.com/ds/filter/cf/4.0/search/?_path=%2Fcf%2F4.0%2Fsearch%2F&l=zh-Hant-TW"
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://tw.carousell.com",
            "Referer": "https://tw.carousell.com/"
        })

    @property
    def platform_name(self) -> str:
        return "Carousell"

    def _get_csrf_token(self) -> Optional[str]:
        try:
            response = self.session.get(self.base_url)
            # Find CSRF token in the set-cookie or script tags
            # Usually Carousell has it in the cookie '_csrf' or a window obj
            csrf_token = self.session.cookies.get("_csrf")
            if not csrf_token:
                # Fallback: search in HTML for something like "csrfToken":"..."
                match = re.search(r'"csrfToken":"([^"]+)"', response.text)
                if match:
                    csrf_token = match.group(1)
            return csrf_token
        except Exception as e:
            print(f"Error getting CSRF token: {e}")
            return None

    def search(self, query: str, count: int = 48) -> List[Dict[str, Any]]:
        csrf_token = self._get_csrf_token()
        if csrf_token:
            self.session.headers.update({"csrf-token": csrf_token})

        payload = {
            "bestMatchEnabled": True,
            "canChangeKeyword": False,
            "count": count,
            "countryCode": "TW",
            "countryId": "1668284",
            "filters": [],
            "includeBpEducationBanner": True,
            "includeListingDescription": True, # We need description for AI
            "includePopularLocations": False,
            "includeSuggestions": True,
            "isCertifiedSpotlightEnabled": False,
            "locale": "zh-Hant-TW",
            "prefill": {},
            "query": query
        }

        try:
            response = self.session.post(self.search_api, json=payload)
            response.raise_for_status()
            data = response.json()
            results = data.get("data", {}).get("results", [])
            
            standardized_results = []
            for item in results:
                card = item.get("listingCard", {})
                if not card: continue
                
                # Extract description from belowFold components if available
                description = ""
                below_fold = card.get("belowFold", [])
                for component in below_fold:
                    if component.get("component") == "paragraph":
                        description = component.get("stringContent", "")
                        break

                # Extract price as float
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
