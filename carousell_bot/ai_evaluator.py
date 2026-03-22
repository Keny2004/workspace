import logging
import requests
import json
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
# You can change to 'llama3' or 'qwen' or 'gemma' if installed
DEFAULT_MODEL = "gemma3:1b" 

def evaluate_deal(item: Dict[str, Any], description: str, model: str = DEFAULT_MODEL) -> Tuple[bool, str]:
    """
    Asks the local Ollama AI to evaluate if this is a good deal based on description.
    """
    title = item.get("title", "")
    price = item.get("price", 0)
    
    if not description or len(description) < 5:
        # If no description, we can't be sure, but usually we reject or tentatively accept
        logger.warning(f"Very short description for {item.get('id')}.")
        return False, "商品描述過短或無法取得，為保險起見已忽略。"
        
    prompt = f"""
You are an expert second-hand phone evaluator for arbitrage. 
Analyze the following Carousell listing:
Title: {title}
Price: {price}
Description:
{description}

Does the description mention any fatal flaws such as:
- Broken screen/glass/back (破裂, 裂痕)
- Motherboard issues (機板不通, 不開機)
- Locked status (鎖機, 忘記密碼)
- Missing important functionalities (Face ID失效, 鏡頭壞)
- Or is this just a mobile case/accessory mislabeled as a phone?

Please respond ONLY in standard JSON format:
{{"is_good_deal": true/false, "reason": "brief explanation in Traditional Chinese"}}
"""
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        ai_response = data.get("response", "{}")
        
        try:
            result = json.loads(ai_response)
        except json.JSONDecodeError:
            # Fallback parsing
            logger.error(f"Failed to parse AI JSON: {ai_response}")
            return False, "AI回覆格式錯誤"
            
        is_good_deal = result.get("is_good_deal", False)
        reason = result.get("reason", "No reason provided.")
        
        logger.info(f"AI Judgment for {item.get('id')}: {is_good_deal} ({reason})")
        return is_good_deal, reason
        
    except requests.exceptions.ConnectionError:
        logger.error("Failed to connect to Local AI (Ollama). Is `ollama serve` running on localhost:11434?")
        return False, "Local AI (Ollama) 未啟動或無法連線"
    except Exception as e:
        logger.error(f"AI Evaluation Error: {e}")
        return False, f"AI評估發生錯誤: {e}"
