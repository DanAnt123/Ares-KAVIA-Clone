# Script to be run once to seed base workout categories.

from website import db
from website.models import Category

def seed_categories():
    base_categories = [
        {"name": "Strength", "description": "Strength training workouts"},
        {"name": "Cardio", "description": "Cardiovascular exercises"},
        {"name": "Flexibility", "description": "Stretching and flexibility"},
        {"name": "Balance", "description": "Balance and stability"}
    ]
    for entry in base_categories:
        if not Category.query.filter_by(name=entry["name"]).first():
            db.session.add(Category(name=entry["name"], description=entry["description"]))
    db.session.commit()
    print("Seeded categories.")

if __name__ == "__main__":
    seed_categories()
