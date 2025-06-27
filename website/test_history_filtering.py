import json
import pytest
from datetime import datetime, timedelta
from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog

@pytest.fixture(autouse=True)
def setup_db():
    """Setup and teardown the database for each test"""
    app = create_app()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SECRET_KEY"] = "secret"
    app.config["TESTING"] = True
    
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(setup_db):
    """Create a test client with a fresh database"""
    app = create_app()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SECRET_KEY"] = "secret"
    app.config["TESTING"] = True
    
    with app.app_context():
        # Create test user and sample data
        user = User(email=f"testuser_{pytest.id}@example.com", password="testpass")
        db.session.add(user)
        db.session.commit()
        
        # Create multiple workouts
        workout1 = Workout(user_id=user.id, name="Push Day", description="Chest and shoulders")
        workout2 = Workout(user_id=user.id, name="Pull Day", description="Back and biceps")
        db.session.add_all([workout1, workout2])
        db.session.commit()
        
        # Create sample exercises
        exercises = [
            Exercise(name="Bench Press", weight=100, include_details=True, workout_id=workout1.id),
            Exercise(name="Shoulder Press", weight=60, include_details=True, workout_id=workout1.id),
            Exercise(name="Pull Ups", weight=0, include_details=True, workout_id=workout2.id),
            Exercise(name="Barbell Row", weight=80, include_details=True, workout_id=workout2.id)
        ]
        db.session.add_all(exercises)
        db.session.commit()
        
        # Create sessions with different dates
        dates = [
            datetime.now(),
            datetime.now() - timedelta(days=1),
            datetime.now() - timedelta(days=7),
            datetime.now() - timedelta(days=14)
        ]
        
        for date in dates:
            # Push day session
            session1 = WorkoutSession(user_id=user.id, workout_id=workout1.id, timestamp=date)
            db.session.add(session1)
            db.session.commit()
            
            log1 = ExerciseLog(
                session_id=session1.id,
                exercise_name="Bench Press",
                weight=100,
                reps=8,
                include_details=True,
                details="Flat bench"
            )
            log2 = ExerciseLog(
                session_id=session1.id,
                exercise_name="Shoulder Press",
                weight=60,
                reps=10,
                include_details=True,
                details="Standing"
            )
            db.session.add_all([log1, log2])
            
            # Pull day session
            session2 = WorkoutSession(user_id=user.id, workout_id=workout2.id, timestamp=date + timedelta(hours=1))
            db.session.add(session2)
            db.session.commit()
            
            log3 = ExerciseLog(
                session_id=session2.id,
                exercise_name="Pull Ups",
                weight=0,
                reps=12,
                include_details=True,
                details="Wide grip"
            )
            log4 = ExerciseLog(
                session_id=session2.id,
                exercise_name="Barbell Row",
                weight=80,
                reps=10,
                include_details=True,
                details="Overhand grip"
            )
            db.session.add_all([log3, log4])
            
        db.session.commit()
        yield app.test_client()

def login(client):
    with client.session_transaction() as sess:
        sess["_user_id"] = "1"

def test_history_page_workout_filter(client):
    """Test filtering history by workout type"""
    login(client)
    
    # Get initial page to verify both workouts are shown
    response = client.get("/history")
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Push Day" in html_content
    assert "Pull Day" in html_content
    
    # Test filtering by Push Day workout
    response = client.get("/history?workout_id=1")
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Push Day" in html_content
    assert "Bench Press" in html_content
    assert "Shoulder Press" in html_content
    assert "Pull Ups" not in html_content
    
    # Test filtering by Pull Day workout
    response = client.get("/history?workout_id=2")
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Pull Day" in html_content
    assert "Pull Ups" in html_content
    assert "Barbell Row" in html_content
    assert "Bench Press" not in html_content

def test_history_page_exercise_filter(client):
    """Test filtering history by specific exercises"""
    login(client)
    
    # Test filtering by Bench Press
    response = client.get("/history", query_string={"exercise": "Bench Press"})
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Bench Press" in html_content
    assert "data-exercise-name=\"Bench Press\"" in html_content
    assert "Pull Ups" not in html_content
    
    # Test filtering by Pull Ups
    response = client.get("/history", query_string={"exercise": "Pull Ups"})
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Pull Ups" in html_content
    assert "data-exercise-name=\"Pull Ups\"" in html_content
    assert "Bench Press" not in html_content

def test_history_page_date_filter(client):
    """Test filtering history by date ranges"""
    login(client)
    
    # Test today's sessions
    response = client.get("/history", query_string={"date": "today"})
    assert response.status_code == 200
    html_content = response.data.decode()
    today = datetime.now().strftime("%Y-%m-%d")
    assert today in html_content
    
    # Test last week's sessions
    response = client.get("/history", query_string={"date": "week"})
    assert response.status_code == 200
    html_content = response.data.decode()
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    assert week_ago in html_content

def test_history_page_sorting(client):
    """Test sorting functionality of history page"""
    login(client)
    
    # Test sorting by date ascending
    response = client.get("/history", query_string={"sort": "date-asc"})
    assert response.status_code == 200
    html_content = response.data.decode()
    # Verify the order of dates
    
    # Test sorting by date descending (default)
    response = client.get("/history", query_string={"sort": "date-desc"})
    assert response.status_code == 200
    html_content = response.data.decode()
    # Verify the order of dates
    
    # Test sorting by workout name
    response = client.get("/history", query_string={"sort": "workout-name"})
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Pull Day" in html_content
    assert "Push Day" in html_content

def test_history_page_combined_filters(client):
    """Test combining multiple filters"""
    login(client)
    
    # Test combining workout and exercise filters
    response = client.get("/history", query_string={
        "workout_id": "1",
        "exercise": "Bench Press"
    })
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Bench Press" in html_content
    assert "Push Day" in html_content
    assert "Pull Ups" not in html_content
    
    # Test combining date and exercise filters
    response = client.get("/history", query_string={
        "date": "today",
        "exercise": "Bench Press"
    })
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "Bench Press" in html_content
    today = datetime.now().strftime("%Y-%m-%d")
    assert today in html_content

def test_history_page_no_matches(client):
    """Test cases where no results should be found"""
    login(client)
    
    # Test non-existent exercise
    response = client.get("/history", query_string={"exercise": "NonexistentExercise"})
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "No matches found" in html_content
    
    # Test non-existent workout
    response = client.get("/history", query_string={"workout_id": "999"})
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "No matches found" in html_content
    
    # Test future date range (should show no results)
    future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    response = client.get("/history", query_string={"date": future_date})
    assert response.status_code == 200
    html_content = response.data.decode()
    assert "No matches found" in html_content

def test_history_api_endpoints(client):
    """Test the API endpoints that support the history page"""
    login(client)
    
    # Test GET /api/workout/history
    response = client.get("/api/workout/history")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    
    # Verify workout session structure
    first_session = data[0]
    assert "workout_name" in first_session
    assert "exercises" in first_session
    assert len(first_session["exercises"]) > 0
    
    # Verify exercise log structure
    first_exercise = first_session["exercises"][0]
    assert "exercise_name" in first_exercise
    assert "weight" in first_exercise
    assert "reps" in first_exercise

def test_history_page_session_details(client):
    """Test that session details are properly displayed"""
    login(client)
    
    response = client.get("/history")
    assert response.status_code == 200
    html_content = response.data.decode()
    
    # Check for session detail elements
    assert "session-details" in html_content
    assert "exercise-log-item" in html_content
    
    # Verify exercise details are shown
    assert "Flat bench" in html_content  # Exercise detail
    assert "Standing" in html_content    # Exercise detail
    assert "Wide grip" in html_content   # Exercise detail
    assert "Overhand grip" in html_content  # Exercise detail
