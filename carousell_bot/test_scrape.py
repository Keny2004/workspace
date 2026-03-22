import scraper
import yaml

items = scraper.fetch_carousell_items("iPhone 14 Pro 128G", sort_by="3")
for item in items[:15]:
    print(f"Title: {item['title']}, Price: {item['price']}")
