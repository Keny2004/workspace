from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseScraper(ABC):
    @property
    @abstractmethod
    def platform_name(self) -> str:
        pass

    @abstractmethod
    def search(self, query: str, **kwargs) -> List[Dict[Any, Any]]:
        """
        Search for products and return a list of standardized dictionaries:
        {
            "external_id": str,
            "title": str,
            "description": str,
            "price": float,
            "url": str,
            "image_url": str (optional)
        }
        """
        pass
