from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g., Phone, Tablet, Laptop
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
    ai_summary = Column(String, nullable=True)
    specification = relationship("Specification", back_populates="scraped_products")

class SystemConfig(Base):
    __tablename__ = "system_configs"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True) # e.g., profit_margin, telegram_token
    value = Column(String)
