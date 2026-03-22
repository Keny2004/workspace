import logging
import statistics
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

def evaluate_item(item: Dict[str, Any], config: Dict[str, Any], target_config: Dict[str, Any], market_price_estimate: float) -> Tuple[bool, str]:
    """
    Evaluates an item to determine if it should be notified and its status.
    Returns: (should_notify: bool, status: str)
    """
    title = item.get("title", "").lower()
    description = item.get("description", "").lower()
    price = float(item.get("price", 0))
    
    analysis_config = config.get("analysis", {})
    threshold_ratio = float(analysis_config.get("great_deal_threshold", 0.85))
    blacklist = [w.lower() for w in analysis_config.get("blacklist_keywords", [])]
    special_words = [w.lower() for w in analysis_config.get("special_classification_keywords", [])]
    
    req_kw = [w.lower() for w in target_config.get("required_keywords", [])]
    exc_kw = [w.lower() for w in target_config.get("excluded_keywords", [])]
    
    text_to_check = f"{title} {description}"
    
    # Check Required Keywords (MUST be in text_to_check)
    for word in req_kw:
        if word not in text_to_check:
            logger.debug(f"Item '{title}' skipped: missing required keyword '{word}'")
            return False, "Ignored - Missing Required Target Keyword"
            
    # Check Excluded Keywords (MUST NOT be in text_to_check)
    for word in exc_kw:
        if word in text_to_check:
            logger.debug(f"Item '{title}' skipped: contains excluded keyword '{word}'")
            return False, "Ignored - Target Excluded Keyword"
    
    # 1. Strict blacklist
    for word in blacklist:
        if word in text_to_check:
            logger.debug(f"Item '{title}' skipped due to strict blacklist keyword: {word}")
            return False, "Ignored - Global Blacklist"
            
    # Sub-filter: Ridiculously low price usually means scam, cases, boxes, or dummy listing
    if price < market_price_estimate * 0.3:
         logger.debug(f"Item '{title}' skipped: price suspiciously low ({price} vs {market_price_estimate}). Might be an accessory.")
         return False, "Ignored - Suspiciously Cheap"
         
    # 2. Check special keywords
    is_special = False
    for word in special_words:
        if word in text_to_check:
            is_special = True
            break
            
    # 3. Evaluate price
    great_deal_price = market_price_estimate * threshold_ratio
    very_cheap_price = market_price_estimate * 0.70
    
    if price <= great_deal_price:
        if is_special:
            if price <= very_cheap_price:
                return True, "Special"
            else:
                return False, "Special (Not Cheap Enough)"
        else:
            return True, "Great Deal"
            
    # Avoid recording or showing completely overpriced items
    if price > market_price_estimate * 1.15:
        return False, "Ignored - Overpriced"
        
    return False, "Normal Deal"

def calculate_dynamic_market_price(items: list, default_price: float) -> float:
    """
    Calculate median market price dynamically with IQR outlier removal.
    """
    valid_prices = [i['price'] for i in items if i['status'] in ('Normal Deal', 'Great Deal') and i['price'] > default_price * 0.4]
    if len(valid_prices) < 5:
        return default_price
        
    # Validations & Outlier elimination using Interquartile Range (IQR) algorithm
    valid_prices.sort()
    n = len(valid_prices)
    q1 = valid_prices[n // 4]
    q3 = valid_prices[(3 * n) // 4]
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    
    filtered_prices = [p for p in valid_prices if lower_bound <= p <= upper_bound]
    if not filtered_prices:
        filtered_prices = valid_prices
        
    return statistics.median(filtered_prices)
