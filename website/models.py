from . import db
from flask_login import UserMixin

from datetime import datetime

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(50), unique=True)
    password = db.Column(db.String(200))
    workouts = db.relationship("Workout")
    # PUBLIC_INTERFACE
    workout_sessions = db.relationship("WorkoutSession", backref="user", lazy=True)


# PUBLIC_INTERFACE
class Category(db.Model):
    """
    Category model for categorizing workouts.
    """
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    workouts = db.relationship("Workout", backref="category", lazy=True)


class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    description = db.Column(db.String(50))
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"), nullable=True)
    exercises = db.relationship("Exercise")


class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(45))
    weight = db.Column(db.Float(5))
    sets = db.Column(db.Integer)
    reps = db.Column(db.String(20))  # Support ranges like "8-12" or "10"
    details = db.Column(db.String(50))  # Increased from 5 to 50 characters for interactive inputs
    include_details = db.Column(db.Boolean)
    workout_id = db.Column(db.Integer, db.ForeignKey("workout.id"))

# PUBLIC_INTERFACE
class WorkoutSession(db.Model):
    """
    Represents a user's workout session for a specific workout at a specific time.
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    workout_id = db.Column(db.Integer, db.ForeignKey("workout.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    exercise_logs = db.relationship("ExerciseLog", backref="session", cascade="all, delete-orphan", lazy=True)
    workout = db.relationship("Workout")  # convenience relationship

# PUBLIC_INTERFACE
class ExerciseLog(db.Model):
    """
    Details of each exercise performed in a WorkoutSession, including sets/reps/weights.
    """
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("workout_session.id"), nullable=False)
    exercise_name = db.Column(db.String(45), nullable=False)
    set_number = db.Column(db.Integer, nullable=True)      # Can be used for multi-set support
    reps = db.Column(db.Integer, nullable=True)
    weight = db.Column(db.Float(5), nullable=True)
    details = db.Column(db.String(10), nullable=True)
    include_details = db.Column(db.Boolean, nullable=True)
