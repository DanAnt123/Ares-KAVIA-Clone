from flask import Flask, redirect, url_for
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os

db = SQLAlchemy()
migrate = Migrate()  # This object is used for Flask-Migrate integration

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", default="006363ce276b892f9f89d16571fd0113")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", default="sqlite:///db.sqlite3")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["PROPAGATE_EXCEPTIONS"] = True

    db.init_app(app)
    migrate.init_app(app, db)  # Initialize Flask-Migrate

    from .auth import auth
    from .views import views

    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(views, url_prefix="/")

    # Call on first request, using shared function
    @app.before_first_request
    def ensure_default_categories():
        # PUBLIC_INTERFACE USAGE
        seed_categories_if_empty()

    login_manager = LoginManager()
    login_manager.login_view = "auth.signin"
    login_manager.login_message = ""
    login_manager.init_app(app)

    from .models import User

    @login_manager.user_loader
    def load_user(id):
        return User.query.get(int(id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return redirect(url_for("auth.signin"))

    return app

# PUBLIC_INTERFACE
def seed_categories_if_empty():
    """
    Ensures the Category table contains default categories if empty.
    """
    from .models import Category
    default_categories = [
        {"name": "Strength", "description": "Strength training workouts"},
        {"name": "Cardio", "description": "Cardiovascular workouts"},
        {"name": "Flexibility", "description": "Flexibility and stretching"},
        {"name": "Other", "description": "Other types of workouts"},
    ]
    if Category.query.count() == 0:
        from . import db
        for cat in default_categories:
            exists = Category.query.filter_by(name=cat["name"]).first()
            if not exists:
                new_cat = Category(name=cat["name"], description=cat["description"])
                db.session.add(new_cat)
        db.session.commit()
