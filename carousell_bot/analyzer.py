import logging
import statistics
import re
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

def is_strict_target_match(title: str, target_name: str) -> bool:
    """
    更嚴格的地檢驗標題是否真的符合目標型號。
    防止「iPhone 14 Pro」目標抓到「iPhone 13 Pro Max」或普通「iPhone 14」。
    """
    title = title.lower()
    target_name = target_name.lower()
    
    # 數字型號檢查 (11, 12, 13, 14, 15, 16)
    model_numbers = ["11", "12", "13", "14", "15", "16"]
    
    # 找出目標中提及的數字
    target_nums = [n for n in model_numbers if re.search(fr'\b{n}\b', target_name)]
    if target_nums:
        # 如果標題提到了其他不同的數字型號，排除 (例如 目標 14, 標題出現 13)
        other_nums = [n for n in model_numbers if re.search(fr'\b{n}\b', title) and n not in target_nums]
        if other_nums:
            return False
            
        # 如果標題連目標數字都沒提到，排除
        if not any(re.search(fr'\b{n}\b', title) for n in target_nums):
            return False

    # 變體檢查 (Pro, Max, Plus, Mini)
    is_pro_target = "pro" in target_name
    is_max_target = "max" in target_name
    is_plus_target = "plus" in target_name
    is_mini_target = "mini" in target_name
    
    is_pro_title = "pro" in title
    is_max_title = "max" in title
    is_plus_title = "plus" in title
    is_mini_title = "mini" in title
    
    # 嚴格對齊：目標是 Pro，標題就必須是 Pro 且不能是普通版或 Plus/Mini (除非型號交疊)
    if is_pro_target != is_pro_title: return False
    if is_max_target != is_max_title: return False
    if is_plus_target != is_plus_title: return False
    if is_mini_target != is_mini_title: return False

    return True

def evaluate_item(item: Dict[str, Any], config: Dict[str, Any], target_config: Dict[str, Any], 
                  dynamic_market_price: Optional[float] = None, buyback_prices: Optional[Dict[str, Any]] = None) -> Tuple[bool, str]:
    """
    Evaluates an item to determine if it should be notified and its status.
    Returns: (should_notify: bool, status: str)
    """
    title = item.get("title", "").lower()
    price = item.get("price", 0)
    target_name = target_config.get("name", "")
    item_spec = item.get("specification", "")
    
    # 0. 基本檢查
    if not is_strict_target_match(title, target_name):
        return False, "Ignored - Strict Model Mismatch"
    
    if price <= 0:
        return False, "Ignored - Zero Price"

    # 1. 排除關鍵字檢查
    excluded_keywords = target_config.get("excluded_keywords", [])
    for exc in excluded_keywords:
        if exc.lower() in title:
            return False, f"Ignored - Excluded Keyword: {exc}"
    
    # 2. 市價判斷
    spec_prices = target_config.get("spec_prices", {})
    base_estimate = target_config.get("market_price_estimate", 0)
    if item_spec in spec_prices:
        base_estimate = spec_prices[item_spec]
    
    market_price = dynamic_market_price if dynamic_market_price else base_estimate
    threshold = config.get("analysis", {}).get("great_deal_threshold", 0.85)

    # 3. [多來源] 收購價保底 (Arbitrage Floor)
    # 取各家平台該規格之最高收購價
    max_buyback = 0
    if buyback_prices:
        prices_for_spec = []
        for vendor, mapping in buyback_prices.items():
            if item_spec in mapping:
                prices_for_spec.append(mapping[item_spec])
        if prices_for_spec:
            max_buyback = max(prices_for_spec)

    buyback_margin = config.get("analysis", {}).get("buyback_margin", 0.20)
    if max_buyback > 0 and price > 0:
        if price <= max_buyback * (1 + buyback_margin):
            return True, f"Great Deal - Arb-Ready (Floor: {max_buyback}, Margin: {int(buyback_margin*100)}%)"

    # 4. 常規門檻判斷
    if price > (market_price * 1.5):
        return False, "Ignored - Way Overpriced"
        
    if price > (market_price * 1.15):
        return False, "Market Item - High"
        
    special_keywords = config.get("analysis", {}).get("special_classification_keywords", [])
    is_special = any(kw.lower() in title for kw in special_keywords)
    
    if price <= (market_price * threshold):
        if is_special:
            return True, "Special Deal"
        return True, "Great Deal (Market Based)"
            
    return False, "Market Item - Normal"

def calculate_dynamic_market_price(items_history, initial_estimate, specification: str = "", target_config: Dict[str, Any] = None):
    """
    利用 IQR 四分位距法排除極端值後計算市場價格的中位數。
    若帶有規格 (specification)，則優先計算該規格的市價。
    """
    base_estimate = initial_estimate
    if target_config and specification:
        spec_prices = target_config.get("spec_prices", {})
        if specification in spec_prices:
            base_estimate = spec_prices[specification]

    if specification:
        # 過濾出特定規格的商品
        spec_items = [item for item in items_history if item.get('specification') == specification]
        if len(spec_items) >= 5:
            return _calculate_median_with_iqr(spec_items, base_estimate)
            
    # 若規格資料不足或未提供規格，則計算全體中位數
    return _calculate_median_with_iqr(items_history, base_estimate)

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
