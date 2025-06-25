#!/usr/bin/env python3
"""
Test script to reproduce the /history endpoint timestamp column issue
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog
from flask_login import login_user
from datetime import datetime

def test_history_endpoint():
    """Test the /history endpoint specifically"""
    app = create_app()
    
    with app.app_context():
        print("Testing /history endpoint...")
        
        # Create test client
        client = app.test_client()
        
        # Create test user if doesn't exist
        test_user = User.query.filter_by(email="test@example.com").first()
        if not test_user:
            test_user = User(email="test@example.com", password="testpass")
            db.session.add(test_user)
            db.session.commit()
            print("Created test user")
        
        # Create test workout and session
        test_workout = Workout.query.filter_by(user_id=test_user.id).first()
        if not test_workout:
            test_workout = Workout(
                name="Test Workout",
                description="Test Description", 
                user_id=test_user.id
            )
            db.session.add(test_workout)
            db.session.commit()
            print("Created test workout")
        
        # Create a test session with exercise logs
        test_session = WorkoutSession(
            user_id=test_user.id,
            workout_id=test_workout.id
        )
        db.session.add(test_session)
        db.session.commit()
        
        # Add some exercise logs
        exercise_log = ExerciseLog(
            session_id=test_session.id,
            exercise_name="Test Exercise",
            reps=10,
            weight=50.0,
            details="Test details"
        )
        db.session.add(exercise_log)
        db.session.commit()
        print("Created test session and exercise log")
        
        # Test 1: Test the API endpoint directly
        print("\n1. Testing /api/workout/history endpoint:")
        try:
            # Simulate logged in user by manipulating session
            with client.session_transaction() as sess:
                sess['_user_id'] = str(test_user.id)
                sess['_fresh'] = True
            
            response = client.get('/api/workout/history')
            print(f"   Status code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"   Response data: {data}")
                print("   ✅ API endpoint test passed!")
            else:
                print(f"   ❌ API endpoint failed with status {response.status_code}")
                print(f"   Response: {response.get_data(as_text=True)}")
                
        except Exception as e:
            print(f"   ❌ API endpoint error: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        # Test 2: Test the HTML endpoint 
        print("\n2. Testing /history HTML endpoint:")
        try:
            response = client.get('/history')
            print(f"   Status code: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ HTML endpoint test passed!")
            elif response.status_code == 302:
                print("   ⚠️  HTML endpoint redirected (probably to login)")
            else:
                print(f"   ❌ HTML endpoint failed with status {response.status_code}")
                print(f"   Response: {response.get_data(as_text=True)}")
                
        except Exception as e:
            print(f"   ❌ HTML endpoint error: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        # Test 3: Direct database query (same as used in views.py)
        print("\n3. Testing direct database query from views.py:")
        try:
            sessions = (
                WorkoutSession.query
                .filter_by(user_id=test_user.id)
                .order_by(WorkoutSession.timestamp.desc())
                .all()
            )
            print(f"   Found {len(sessions)} sessions")
            for session in sessions:
                print(f"   Session {session.id}: {session.timestamp}, workout: {session.workout.name if session.workout else 'None'}")
            print("   ✅ Direct query test passed!")
            
        except Exception as e:
            print(f"   ❌ Direct query error: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        return True

if __name__ == "__main__":
    success = test_history_endpoint()
    if success:
        print("\n✅ All history endpoint tests passed!")
    else:
        print("\n❌ History endpoint tests failed!")
    sys.exit(0 if success else 1)
