import logging
import requests
import json
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
# 可以更改為 'llama3' 或 'qwen2.5:7b' 等模型
DEFAULT_MODEL = "gemma3:1b" 

def evaluate_deal(item: Dict[str, Any], description: str, user_prefs: Dict[str, Any] = None, model: str = DEFAULT_MODEL) -> Tuple[bool, bool, str, Dict[str, str]]:
    """
    要求本地 AI (Ollama) 評估商品描述，判斷是否為無嚴重暗病的好物，或判定為零件機。
    同時提取規格、面交地點與交易方式。
    返回: (是否為套利好物, 是否為零件機, 判斷理由, 詳細資訊字典)
    """
    title = item.get("title", "")
    price = item.get("price", 0)
    
    if not description or len(description) < 5:
        logger.warning(f"商品 {item.get('id')} 的描述過短。")
        return False, False, "商品描述過短或無法取得，為保險起見已忽略。"
        
    pref_str = ""
    if user_prefs:
        pref_str = f"\n我的交易偏好：\n- 理想面交地點: {user_prefs.get('locations', '無限制')}\n- 理想交易方式: {user_prefs.get('payments', '無限制')}"

    prompt = f"""你是一位專業的台灣二手 3C 買賣專家。用戶是一位「二手買賣商家」，你的任務是從大量網頁抓取到的描述中，排除掉「真的壞掉」的零件機，並核准「正常的二手商品」。

請注意：
1. 「二手 (Second-hand/Used)」狀態是完全正常且我們想要的。絕不可因為描述提到「二手」或「舊品」就判定為瑕疵。
2. 真正的致命瑕疵包括：破螢幕/玻璃、不開機、死機、iCloud鎖(ID鎖)、遺失 Face ID 或指紋、具備功能性缺陷(如 WiFi 壞、相機黑屏)。
3. 若描述中僅提到「正常使用跡象」、「過保」、「無盒」，皆屬於正常二手狀態 (is_good_deal: true)。

以下是旋轉拍賣的商品資訊：
標題: {title}
價格: {price}
描述:
{description}
{pref_str}

請執行以下任務：
1. 提取資訊：精確規格(必須包含型號變體如 Pro/Plus/Max 與容量如 128G/256G，例如 "Pro Max 256G")、單一的面交地點、主要的交易方式。
2. 判斷是否為零件機或故障品。

請「務必」只回覆標準 JSON 格式。格式如下：
{{
  "is_good_deal": true/false, 
  "is_parts_machine": true/false, 
  "reason": "繁體中文理由(約15字)",
  "specification": "如 Pro Max 256G (務必包含型號變體與規格，若無則留空)",
  "location": "地標或城市 (若無則留空)",
  "payment": "面交/寄送等 (若無則留空)",
  "confidence": 1-10 (對此判斷的信心分數)
}}
"""
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        logger.info(f"正在傳送給 {model} 進行 AI 解析...")
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        ai_response = data.get("response", "{}")
        
        try:
            result = json.loads(ai_response)
        except json.JSONDecodeError:
            logger.error(f"解析 AI 回傳的 JSON 失敗: {ai_response}")
            return False, False, "AI 回覆格式錯誤"
            
        is_good_deal = result.get("is_good_deal", False)
        is_parts_machine = result.get("is_parts_machine", False)
        reason = result.get("reason", "無提供理由。")
        
        details = {
            "specification": result.get("specification", ""),
            "location": result.get("location", ""),
            "payment": result.get("payment", "")
        }
        
        # 覆寫互斥邏輯
        if is_parts_machine:
            is_good_deal = False

        logger.info(f"AI 判定結果 -> 正常套利: {is_good_deal}, 零件機: {is_parts_machine} ({reason}) | 規格: {details['specification']}")
        return is_good_deal, is_parts_machine, reason, details
        
    except requests.exceptions.ConnectionError:
        logger.error("無法連線至本地 AI (Ollama) 伺服器。")
        return False, False, "本地 AI 未啟動", {}
    except Exception as e:
        logger.error(f"AI 評估時發生未知的錯誤: {e}")
        return False, False, f"AI 評估發生錯誤: {e}", {}
