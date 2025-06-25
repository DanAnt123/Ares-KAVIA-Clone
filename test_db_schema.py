#!/usr/bin/env python3
"""
Test script to reproduce the WorkoutSession timestamp column issue
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog
from datetime import datetime

def test_database_schema():
    """Test the database schema and WorkoutSession queries"""
    app = create_app()
    
    with app.app_context():
        print("Testing database schema...")
        
        # Test 1: Check if tables exist
        print("\n1. Checking if tables exist:")
        try:
            # This should work if tables exist
            user_count = User.query.count()
            print(f"   Users table exists: {user_count} users")
            
            workout_count = Workout.query.count()
            print(f"   Workouts table exists: {workout_count} workouts")
            
            session_count = WorkoutSession.query.count()
            print(f"   WorkoutSession table exists: {session_count} sessions")
            
            log_count = ExerciseLog.query.count() 
            print(f"   ExerciseLog table exists: {log_count} logs")
            
        except Exception as e:
            print(f"   Error checking tables: {e}")
            return False
        
        # Test 2: Try to create and query a WorkoutSession
        print("\n2. Testing WorkoutSession creation and query:")
        try:
            # First create a test user if none exists
            test_user = User.query.first()
            if not test_user:
                test_user = User(email="test@example.com", password="testpass")
                db.session.add(test_user)
                db.session.commit()
                print("   Created test user")
            
            # Create a test workout if none exists
            test_workout = Workout.query.filter_by(user_id=test_user.id).first()
            if not test_workout:
                test_workout = Workout(
                    name="Test Workout",
                    description="Test Description", 
                    user_id=test_user.id
                )
                db.session.add(test_workout)
                db.session.commit()
                print("   Created test workout")
            
            # Try to create a WorkoutSession - this should test the timestamp column
            test_session = WorkoutSession(
                user_id=test_user.id,
                workout_id=test_workout.id
            )
            db.session.add(test_session)
            db.session.commit()
            print(f"   Created WorkoutSession with ID: {test_session.id}")
            print(f"   Session timestamp: {test_session.timestamp}")
            
            # Test 3: Query WorkoutSession with timestamp ordering (this is where the error occurs)
            print("\n3. Testing WorkoutSession query with timestamp ordering:")
            sessions = WorkoutSession.query.filter_by(user_id=test_user.id).order_by(WorkoutSession.timestamp.desc()).all()
            print(f"   Successfully queried {len(sessions)} sessions")
            
            for session in sessions:
                print(f"   Session {session.id}: {session.timestamp}")
            
            return True
            
        except Exception as e:
            print(f"   Error with WorkoutSession operations: {e}")
            print(f"   Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = test_database_schema()
    if success:
        print("\n✅ All database tests passed!")
    else:
        print("\n❌ Database tests failed!")
    sys.exit(0 if success else 1)
