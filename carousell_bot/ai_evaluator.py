import logging
import requests
import json
import re
from typing import Dict, Any, Optional, List, Tuple

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
# 可以更改為 'llama3' 或 'qwen2.5:7b' 等模型
DEFAULT_MODEL = "gemma3:1b" 

def extract_spec_from_text(text: str) -> str:
    """
    快速利用正則表達式從標題或描述中提取規格 (如 128G, 256G, Pro Max 等)。
    """
    if not text:
        return ""
    
    # 容量匹配 (支援 G, GB, T, TB, 且不分大小寫)
    # 使用 findall 並取最後一個，因為在標題中「16G 512G」，512G 通常才是儲存容量
    size_matches = re.findall(r'(\d+)\s*(GB|G|TB|T)(?!\w)', text, re.IGNORECASE)
    size_str = ""
    if size_matches:
        num, unit = size_matches[-1]
        unit = unit.upper()
        if unit in ["G", "GB"]:
            size_str = f"{num}G"
        else:
            size_str = f"{num}T"

    # 型號變體匹配
    variants = []
    # 這裡的順序很重要，先匹配長的
    if re.search(r'\bPro\s*Max\b', text, re.IGNORECASE):
        variants.append("Pro Max")
    elif re.search(r'\bPro\b', text, re.IGNORECASE):
        variants.append("Pro")
        
    if re.search(r'\bPlus\b', text, re.IGNORECASE):
        variants.append("Plus")
    if re.search(r'\bMini\b', text, re.IGNORECASE):
        variants.append("Mini")
    if re.search(r'\bUltra\b', text, re.IGNORECASE):
        variants.append("Ultra")

    variant_str = " ".join(variants)
    
    # 組合結果
    result = f"{variant_str} {size_str}".strip()
    return result

def evaluate_deal(item: Dict[str, Any], description: str, category: str = "phone", 
                  user_prefs: Dict[str, Any] = None, buyback_prices: Optional[Dict[str, Any]] = None, 
                  model: str = DEFAULT_MODEL) -> Tuple[bool, bool, str, Dict[str, Any]]:
    """
    要求本地 AI (Ollama) 評估商品描述，判斷是否為無嚴重暗病的好物，或判定為零件機。
    支援 Phone, Tablet, Laptop 多機種。
    """
    title = item.get("title", "")
    price = item.get("price", 0)
    item_spec = item.get("specification", "")
    
    if not description or len(description) < 5:
        return False, False, "商品描述過短或無法取得。", {}
        
    pref_str = ""
    if user_prefs:
        pref_str = f"- 理想面交地點: {user_prefs.get('locations', '無限制')}\n- 理想交易方式: {user_prefs.get('payments', '無限制')}"

    # 計算各家平台對該規格最高的收購價作為參考
    best_floor = 0
    if buyback_prices:
        floors = [m.get(item_spec, 0) for m in buyback_prices.values() if item_spec in m]
        if floors:
            best_floor = max(floors)

    buyback_info = f"該型號目前市場最高收購價(保底)約為 {best_floor} TWD。" if best_floor > 0 else "目前無精確收購價參考。"

    prompt = f"""你是一位專業的台灣二手 3C 交易專家。你的任務是分析 Carousell 商品描述，摘要其實際物理狀況，並特別辨識是否存在非原廠維修或零件更換（如換過螢幕、電池等）。
    
[參考資訊]
類別: {category} (phone/tablet/laptop)

[分析指令]
1. **規格提取**: 
   - Phone/Tablet: 型號與容量 (如 iPad Pro 13, 256G)。
   - Laptop: **年份、CPU(M1-M4)、RAM容量、SSD大小** (如 MacBook Pro 14 2024, 24G/1T)。
2. **狀況摘要 (AI Summary)**: 撰寫 1-2 句商品物理狀況摘要（如：外觀 9 成新，功能正常，電池健康度 85%）。
3. **硬體驗證**: 
   - 辨識是否為「零件機」或「故障機」。
   - **特別標註是否更換過副廠零件**（如換過第三方螢幕、換過非原廠電池）。
4. **排除行為**: 排除收購商廣告、純空盒、模型機。
5. **提取細節**: 地點、付款方式、是否支援面交等。

[商品資訊]
標題: {title}
描述: {description}

請回覆標準 JSON 格式：
{{
  "is_parts_machine": bool,
  "condition_level": "A/B/C/D" (A: 全新/極新, B: 正常二手, C: 瑕疵/副廠件, D: 故障/零件機),
  "ai_reason": "簡短判斷理由",
  "details": {{
    "specification": "規格描述",
    "location": "地區",
    "payment": "付款方式",
    "is_pickup_available": bool,
    "is_cod_available": bool,
    "battery_info": "數據或狀態",
    "has_replaced_parts": bool,
    "ai_summary": "狀況摘要"
  }}
}}
"""
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        logger.info(f"正在傳送給 {model} 進行 AI 解析 (收購價參考: {buyback_price})...")
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        ai_response = data.get("response", "{}")
        
        try:
            result = json.loads(ai_response)
        except json.JSONDecodeError:
            logger.error(f"解析 AI 回傳的 JSON 失敗: {ai_response}")
            return False, False, "AI 回覆格式錯誤", {}
            
        is_parts_machine = result.get("is_parts_machine", False)
        reason = result.get("ai_reason", "無提供理由。")
        details = result.get("details", {})
        
        # 根據 condition_level 判定是否為潛在好物 (這不包含價格因素)
        condition_level = result.get("condition_level", "B")
        is_good_condition = condition_level in ["A", "B"]
        
        # 規格補強
        if not details.get("specification"):
            details["specification"] = extract_spec_from_text(title)

        summary = details.get("ai_summary", "")
        if "空盒" in reason or "空盒" in summary or "不含手機" in summary:
            is_parts_machine = True
            reason = "此為空盒 (Box Only)"

        logger.info(f"AI 判定結果 -> 狀態等級: {condition_level}, 零件機: {is_parts_machine} ({reason})")
        return is_good_condition, is_parts_machine, reason, details
        
    except requests.exceptions.ConnectionError:
        logger.error("無法連線至本地 AI (Ollama) 伺服器。")
        return False, False, "本地 AI 未啟動", {}
    except Exception as e:
        logger.error(f"AI 評估時發生未知的錯誤: {e}")
        return False, False, f"AI 評估發生錯誤: {e}", {}
