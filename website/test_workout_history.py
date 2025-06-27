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

def test_history_page_with_exercise_filtering(client):
    login(client)
    
    # Create multiple workout sessions with different exercises
    workout = Workout.query.first()
    
    # Create session 1 with multiple exercises
    session1 = WorkoutSession(user_id=1, workout_id=workout.id)
    db.session.add(session1)
    db.session.commit()
    
    log1 = ExerciseLog(
        session_id=session1.id,
        exercise_name="BENCH PRESS",
        weight=80,
        reps=8,
        include_details=True
    )
    log2 = ExerciseLog(
        session_id=session1.id,
        exercise_name="SQUAT",
        weight=120,
        reps=5,
        include_details=True
    )
    db.session.add_all([log1, log2])
    db.session.commit()
    
    # Create session 2 with some overlapping exercises
    session2 = WorkoutSession(user_id=1, workout_id=workout.id)
    db.session.add(session2)
    db.session.commit()
    
    log3 = ExerciseLog(
        session_id=session2.id,
        exercise_name="BENCH PRESS",
        weight=85,
        reps=6,
        include_details=True
    )
    log4 = ExerciseLog(
        session_id=session2.id,
        exercise_name="DEADLIFT",
        weight=140,
        reps=5,
        include_details=True
    )
    db.session.add_all([log3, log4])
    db.session.commit()
    
    # Test the history page rendering
    resp = client.get("/history")
    assert resp.status_code == 200
    
    # Check that the page content includes our exercise data attributes
    html_content = resp.data.decode()
    assert 'data-exercise-name="BENCH PRESS"' in html_content
    assert 'data-exercise-name="SQUAT"' in html_content
    assert 'data-exercise-name="DEADLIFT"' in html_content
    
    # Verify unique exercises are properly formatted
    assert '"BENCH PRESS"' in html_content
    assert '"SQUAT"' in html_content
    assert '"DEADLIFT"' in html_content
    
    # Test the API endpoint
    resp = client.get("/api/workout/history")
    assert resp.status_code == 200
    history = resp.get_json()
    
    # Verify the API returns the correct exercise data
    assert len(history) == 2  # Two sessions
    exercises_in_first_session = [e["exercise_name"] for e in history[0]["exercises"]]
    assert "BENCH PRESS" in exercises_in_first_session
    assert "DEADLIFT" in exercises_in_first_session
