import sys
import os
import random

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.yahoo_scraper import YahooScraper

def test_scraper():
    scraper = YahooScraper()
    queries = ["iPhone 15", "iPad Air 5", "MacBook Pro M1"]
    query = random.choice(queries)
    
    print(f"=" * 60)
    print(f"Testing YahooScraper with query: {query}")
    print(f"=" * 60)
    
    try:
        results = scraper.search(query)
        print(f"\nSearch completed. Found {len(results)} results.\n")
        
        for i, item in enumerate(results[:10]):  # Show first 10
            print(f"[{i+1}] {item['title']}")
            print(f"    Price: NT${item['price']:,.0f}")
            print(f"    URL: {item['url']}")
            print(f"    Image: {item['image_url'][:80]}..." if item.get('image_url') else "    Image: N/A")
            print(f"    ID: {item['external_id']}")
            print()
            
        if len(results) > 0:
            print("=" * 60)
            print("SUCCESS: YahooScraper successfully retrieved data.")
            print("=" * 60)
            
            # Validate required fields
            required_keys = ["external_id", "title", "price", "url"]
            for key in required_keys:
                assert key in results[0], f"Missing required key: {key}"
            print("FORMAT CHECK: All required fields present ✓")
            
            # Test detail fetching for first result
            print(f"\n--- Testing detail fetch for first result ---")
            details = scraper.get_item_details(results[0]['url'])
            if details:
                print(f"  Description: {details.get('description', '')[:100]}...")
                print(f"  Status: {details.get('status', 'N/A')}")
                print("DETAIL FETCH: OK ✓")
            else:
                print("DETAIL FETCH: No details returned (may be expected)")
        else:
            print("WARNING: Scraper returned 0 results. Site structure may have changed.")
            
    except RuntimeError as e:
        if "FORBIDDEN_403" in str(e):
            print(f"BLOCKED: Got 403 Forbidden. The site is blocking requests.")
        else:
            print(f"FAILED: {e}")
    except Exception as e:
        print(f"FAILED: Scraper encountered an error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_scraper()
