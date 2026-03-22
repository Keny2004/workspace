import sys
import os

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.valuation_scraper import ValuationScraper

def test_valuation():
    vs = ValuationScraper()
    
    # Test US3C
    us3c_url = "https://www.us3c.com.tw/promotion-recycle-phones"
    print(f"\nTesting US3C Scraping: {us3c_url}")
    try:
        results = vs.scrape_dynamic_url(us3c_url)
        print(f"US3C: Found {len(results)} items.")
        if results:
            for i, item in enumerate(results[:3]):
                print(f"  [{i+1}] {item['model']} {item['specs']} - NT${item['price']}")
        else:
            print("  WARNING: No results from US3C.")
    except Exception as e:
        print(f"  FAILED: US3C error: {e}")

    # Test Sogo3C
    sogo_url = "https://sogo3cphone.com/product/detail/31"
    print(f"\nTesting Sogo3C Scraping: {sogo_url}")
    try:
        results = vs.scrape_dynamic_url(sogo_url)
        print(f"Sogo3C: Found {len(results)} items.")
        if results:
            for i, item in enumerate(results[:3]):
                print(f"  [{i+1}] {item['model']} - NT${item['price']}")
        else:
            print("  WARNING: No results from Sogo3C.")
    except Exception as e:
        print(f"  FAILED: Sogo3C error: {e}")

if __name__ == "__main__":
    test_valuation()
