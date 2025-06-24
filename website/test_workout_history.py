import json
import pytest
from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog

@pytest.fixture
def client():
    app = create_app()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SECRET_KEY"] = "secret"
    app.config["TESTING"] = True
    with app.app_context():
        db.create_all()
        # Create user and login
        user = User(email="testuser@example.com", password="testpass")
        db.session.add(user)
        db.session.commit()
        workout = Workout(
            user_id=user.id, name="WorkoutA", description="Desc"
        )
        db.session.add(workout)
        db.session.commit()
        exercise = Exercise(
            name="Squat", weight=100, include_details=True, workout_id=workout.id, details="seat 2"
        )
        db.session.add(exercise)
        db.session.commit()
        yield app.test_client()

def login(client):
    # Direct session manipulation or endpoint post, depending on login route design
    with client.session_transaction() as sess:
        # If you have flask_login setup, you'll want _user_id
        sess["_user_id"] = "1"

def test_workout_history_flow(client):
    login(client)
    # Test POST with missing data
    resp = client.post(
        "/api/workout/history",
        data=json.dumps({}),
        content_type="application/json"
    )
    assert resp.status_code == 400

    # Test POST with bad workout_id
    resp = client.post(
        "/api/workout/history",
        data=json.dumps({"workout_id": 999, "exercises": []}),
        content_type="application/json"
    )
    assert resp.status_code == 400 or resp.status_code == 404

    # Test POST with valid session and log
    data = {
        "workout_id": 1,
        "exercises": [
            {
                "exercise_name": "Squat",
                "set_number": 1,
                "reps": 6,
                "weight": 120,
                "details": "deep",
                "include_details": True,
            }
        ]
    }
    resp = client.post("/api/workout/history", data=json.dumps(data), content_type="application/json")
    assert resp.status_code == 201
    out = resp.get_json()
    assert "session_id" in out

    # Test GET returns correct session
    resp = client.get("/api/workout/history")
    assert resp.status_code == 200
    history = resp.get_json()
    assert isinstance(history, list)
    assert len(history) >= 1
    assert history[0]["workout_name"] == "WorkoutA"

def test_empty_history(client):
    login(client)
    resp = client.get("/api/workout/history")
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)
