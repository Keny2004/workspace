import sys
import os
import random

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.carousell_scraper import CarousellScraper

def test_scraper():
    scraper = CarousellScraper()
    queries = ["iPhone 15", "iPad Air 5", "MacBook Pro M1"]
    query = random.choice(queries)
    
    print(f"Testing CarousellScraper with query: {query}")
    try:
        results = scraper.search(query, count=5)
        print(f"Search completed. Found {len(results)} results.")
        
        for i, item in enumerate(results):
            print(f"[{i+1}] {item['title']} - NT${item['price']}")
            
        if len(results) > 0:
            print("SUCCESS: Scraper successfully retrieved data using Direct IP.")
        else:
            print("WARNING: Scraper returned 0 results. Might be blocked or no items found.")
            
    except Exception as e:
        print(f"FAILED: Scraper encountered an error: {e}")

if __name__ == "__main__":
    test_scraper()
