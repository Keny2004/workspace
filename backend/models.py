from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g., Phone, Tablet, Laptop
    custom_margin = Column(Float, nullable=True)
    models = relationship("ProductModel", back_populates="category")

class ProductModel(Base):
    __tablename__ = "product_models"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    name = Column(String, index=True) # e.g., iPhone 14 Pro
    category = relationship("Category", back_populates="models")
    specifications = relationship("Specification", back_populates="model")

class Specification(Base):
    __tablename__ = "specifications"
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("product_models.id"))
    name = Column(String, index=True) # e.g., 256GB, 16GB+512GB
    is_monitored = Column(Boolean, default=False)
    custom_margin = Column(Float, nullable=True)
    model = relationship("ProductModel", back_populates="specifications")
    market_prices = relationship("MarketPrice", back_populates="specification")
    scraped_products = relationship("ScrapedProduct", back_populates="specification")

class MarketPrice(Base):
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True, index=True)
    specification_id = Column(Integer, ForeignKey("specifications.id"))
    price = Column(Float)
    source = Column(String) # e.g., US3C, Sogo3C
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    specification = relationship("Specification", back_populates="market_prices")

class ScrapedProduct(Base):
    __tablename__ = "scraped_products"
    id = Column(Integer, primary_key=True, index=True)
    specification_id = Column(Integer, ForeignKey("specifications.id"))
    platform = Column(String) # e.g., Carousell, Facebook, PTT
    external_id = Column(String, index=True) # ID from the platform
    title = Column(String)
    description = Column(Text)
    price = Column(Float)
    url = Column(String, unique=True)
    scraped_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_potential_profit = Column(Boolean, default=False)
    is_faulty = Column(Boolean, default=False)
    is_ai_validated = Column(Boolean, default=False) # AI confirmed spec match
    tags = Column(String, nullable=True) # e.g., "螢幕漏液,故障機"
    ai_summary = Column(String, nullable=True)
    raw_metadata = Column(Text, nullable=True) # JSON for status, location, transaction, time
    specification = relationship("Specification", back_populates="scraped_products")

class SystemConfig(Base):
    __tablename__ = "system_configs"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True) # e.g., profit_margin, telegram_token
    value = Column(String)

class CrawlerStats(Base):
    __tablename__ = "crawler_stats"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    scanned_count = Column(Integer, default=0)
    filtered_count = Column(Integer, default=0)
    potential_count = Column(Integer, default=0)

class MarketPrediction(Base):
    __tablename__ = "market_predictions"
    id = Column(Integer, primary_key=True, index=True)
    specification_id = Column(Integer, ForeignKey("specifications.id"))
    predicted_price = Column(Float)
    sample_size = Column(Integer) # Number of items used for median
    ai_analysis = Column(Text, nullable=True) # JSON output from LLM
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    specification = relationship("Specification")
