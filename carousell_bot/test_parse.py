import scraper
from bs4 import BeautifulSoup
from curl_cffi import requests

res = requests.get("https://tw.carousell.com/search/iPhone%2014%20Pro?sort_by=3", impersonate="chrome")
soup = BeautifulSoup(res.text, "html.parser")
cards = soup.find_all("div", attrs={"data-testid": lambda x: x and x.startswith("listing-card-")})
if cards:
    print(cards[0].prettify()[:1500])
