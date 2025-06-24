from . import db
from flask_login import UserMixin


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(50), unique=True)
    password = db.Column(db.String(200))
    workouts = db.relationship("Workout")


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
    name = db.Column(db.String(12))
    description = db.Column(db.String(18))
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"), nullable=True)
    exercises = db.relationship("Exercise")


class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(45))
    weight = db.Column(db.Float(5))
    sets = db.Column(db.Integer)
    reps = db.Column(db.String(20))  # Support ranges like "8-12" or "10"
    details = db.Column(db.String(5))
    include_details = db.Column(db.Boolean)
    workout_id = db.Column(db.Integer, db.ForeignKey("workout.id"))


# PUBLIC_INTERFACE
class WorkoutSession(db.Model):
    """
    Represents a completed instance of a workout by a user.

    Fields:
    - id: Primary key
    - user_id: Foreign key to User who completed the workout
    - workout_id: Foreign key to the Workout template
    - completed_at: DateTime when the workout was completed
    - notes: (Optional) User-provided notes about this session

    Relationships:
    - exercise_sessions: List of ExerciseSession objects in this workout session
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete="CASCADE"), nullable=False)
    workout_id = db.Column(db.Integer, db.ForeignKey('workout.id', ondelete="CASCADE"), nullable=False)
    completed_at = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.String(255))
    exercise_sessions = db.relationship(
        'ExerciseSession', backref='workout_session', passive_deletes=True, lazy=True
    )


# PUBLIC_INTERFACE
class ExerciseSession(db.Model):
    """
    Represents the details for a single exercise performed in a WorkoutSession.

    Fields:
    - id: Primary key
    - workout_session_id: Foreign key to associated WorkoutSession
    - exercise_id: Foreign key to Exercise template
    - name: Name of the exercise (copied for historical accuracy)
    - details: Details/instructions for the exercise (copied for historical accuracy)
    - weight: (Optional) The amount of weight used
    - reps: (Optional) The number of repetitions performed
    - sets: (Optional) The number of sets performed
    - order: Order of the exercise in the session
    - notes: (Optional) Custom user notes for this exercise

    Relationships:
    - workout_session: The parent WorkoutSession
    """
    id = db.Column(db.Integer, primary_key=True)
    workout_session_id = db.Column(
        db.Integer, db.ForeignKey('workout_session.id', ondelete="CASCADE"), nullable=False
    )
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    name = db.Column(db.String(45), nullable=False)
    details = db.Column(db.String(90))
    weight = db.Column(db.Float)
    reps = db.Column(db.Integer)
    sets = db.Column(db.Integer)
    order = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.String(255))

