import os
from .database import SessionLocal
from .models import SystemConfig

def get_config_value(key: str, default: str = None) -> str:
    """
    Get config value from DB first, then Env.
    """
    db = SessionLocal()
    try:
        conf = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if conf and conf.value:
            return conf.value
    except Exception as e:
        print(f"Error fetching config {key} from DB: {e}")
    finally:
        db.close()
    
    # Fallback to Env
    env_key = key.upper()
    return os.getenv(env_key, default)
