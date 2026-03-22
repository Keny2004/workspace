from sqlalchemy.orm import Session
from .database import SessionLocal, init_db
from . import models

def seed_data():
    db = SessionLocal()
    # 1. Categories (Traditional Chinese)
    categories = ["手機", "平板", "筆電"]
    cat_objs = {}
    for name in categories:
        cat = db.query(models.Category).filter(models.Category.name == name).first()
        if not cat:
            cat = models.Category(name=name)
            db.add(cat)
            db.commit()
            db.refresh(cat)
        cat_objs[name] = cat

    # 2. Example Models & Specs
    # iPhone 15 Pro
    m_15pro = db.query(models.ProductModel).filter(models.ProductModel.name == "iPhone 15 Pro").first()
    if not m_15pro:
        m_15pro = models.ProductModel(name="iPhone 15 Pro", category_id=cat_objs["手機"].id)
        db.add(m_15pro)
        db.commit()
        db.refresh(m_15pro)
    
    for cap in ["128G", "256G", "512G"]:
        spec = db.query(models.Specification).filter(
            models.Specification.model_id == m_15pro.id, 
            models.Specification.name == cap
        ).first()
        if not spec:
            db.add(models.Specification(model_id=m_15pro.id, name=cap))
    
    # iPad Air 5
    m_ipad_air5 = db.query(models.ProductModel).filter(models.ProductModel.name == "iPad Air 5").first()
    if not m_ipad_air5:
        m_ipad_air5 = models.ProductModel(name="iPad Air 5", category_id=cat_objs["平板"].id)
        db.add(m_ipad_air5)
        db.commit()
        db.refresh(m_ipad_air5)
    
    for cap in ["64G", "256G"]:
        spec = db.query(models.Specification).filter(
            models.Specification.model_id == m_ipad_air5.id, 
            models.Specification.name == cap
        ).first()
        if not spec:
            db.add(models.Specification(model_id=m_ipad_air5.id, name=cap))

    db.commit()
    db.close()

if __name__ == "__main__":
    init_db()
    seed_data()
