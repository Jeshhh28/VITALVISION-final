"""Seed demo user for Swagger testing."""

from sqlalchemy.orm import Session

from app.database import SessionLocal
from models import User


def seed_demo_user() -> None:
    db: Session = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "demo").first()
        if existing:
            print("Demo user already exists.")
            return
        db.add(User(username="demo", display_name="VitalVision Demo User"))
        db.commit()
        print("Demo user created.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_user()
