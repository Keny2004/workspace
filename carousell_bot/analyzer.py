import logging
import statistics
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

def evaluate_item(item: Dict[str, Any], config: Dict[str, Any], target_config: Dict[str, Any], dynamic_market_price: Optional[float] = None) -> Tuple[bool, str]:
    """
    Evaluates an item to determine if it should be notified and its status.
    Returns: (should_notify: bool, status: str)
    """
    title = item.get("title", "").lower()
    price = item.get("price", 0)
    
    # Check Required Keywords (MUST have all)
    required_keywords = target_config.get("required_keywords", [])
    if required_keywords and isinstance(required_keywords, list):
        for req in required_keywords:
            if req.lower() not in title:
                return False, "Ignored - Missing Required Keyword"
                
    # Check Excluded Keywords (MUST NOT have any)
    excluded_keywords = target_config.get("excluded_keywords", [])
    if excluded_keywords and isinstance(excluded_keywords, list):
        for exc in excluded_keywords:
            if exc.lower() in title:
                return False, "Ignored - Contains Excluded Keyword"
    
    # 全域黑名單檢查 (如配件、假機等)
    blacklist = config.get("analysis", {}).get("blacklist_keywords", [])
    for keyword in blacklist:
        if keyword.lower() in title:
            return False, "Ignored - Blacklisted"
            
    # 如果抓不到價格，直接忽略
    if price <= 0:
        return False, "Ignored - Zero Price"
        
    market_price = dynamic_market_price if dynamic_market_price else target_config.get("market_price_estimate", 0)
    threshold = config.get("analysis", {}).get("great_deal_threshold", 0.85)
    
    # 理論上真正的超低價不可能低於市價 30% (除非是賣空盒或惡搞)
    # 如果太貴，標記為高價市價
    if price > (market_price * 1.5):
        return False, "Ignored - Way Overpriced"
        
    if price > (market_price * 1.15):
        return False, "Market Item - High"
        
    # 特殊微瑕疵關鍵字檢查
    special_keywords = config.get("analysis", {}).get("special_classification_keywords", [])
    is_special = any(kw.lower() in title for kw in special_keywords)
    
    if price <= (market_price * threshold):
        if is_special:
            return True, "Special" # 需要 AI 介入
        else:
            return True, "Great Deal" # 需要 AI 介入
            
    return False, "Market Item - Normal" # 普通市價，僅存入庫中不推播

def calculate_dynamic_market_price(items_history, initial_estimate, specification: str = ""):
    """
    利用 IQR 四分位距法排除極端值後計算市場價格的中位數。
    若帶有規格 (specification)，則優先計算該規格的市價。
    """
    if specification:
        # 過濾出特定規格的商品
        spec_items = [item for item in items_history if item.get('specification') == specification]
        if len(spec_items) >= 5:
            return _calculate_median_with_iqr(spec_items, initial_estimate)
            
    # 若規格資料不足或未提供規格，則計算全體中位數
    return _calculate_median_with_iqr(items_history, initial_estimate)

def _calculate_median_with_iqr(items, initial_estimate):
    if not items or len(items) < 5:
        return initial_estimate
        
    prices = [item['price'] for item in items if item['price'] > 0]
    prices.sort()
    
    n = len(prices)
    q1 = prices[n // 4]
    q3 = prices[(3 * n) // 4]
    iqr = q3 - q1
    
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    
    filtered_prices = [p for p in prices if lower_bound <= p <= upper_bound]
    if not filtered_prices:
        return initial_estimate
        
    return statistics.median(filtered_prices)
