#!/usr/bin/env python3
"""
Test script to verify that the exercise completion logic works correctly.
This script tests that exercises are only marked as 'completed' after logging a top set.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog
from flask_login import login_user
import tempfile

def test_completion_logic():
    """Test that exercises are only completed after logging top sets."""
    
    # Create test app with in-memory database
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create test user
        test_user = User(email='test@example.com', password='password')
        db.session.add(test_user)
        db.session.commit()
        
        # Create test workout
        test_workout = Workout(
            name='Test Workout',
            description='A test workout',
            user_id=test_user.id
        )
        db.session.add(test_workout)
        db.session.commit()
        
        # Create test exercises
        exercise1 = Exercise(
            name='BENCH PRESS',
            workout_id=test_workout.id,
            weight=None,  # No weight set initially
            reps=None,
            details='',
            include_details=True
        )
        
        exercise2 = Exercise(
            name='SQUATS',
            workout_id=test_workout.id,
            weight=100.0,  # Weight set but no workout session logged
            reps='8-10',
            details='',
            include_details=True
        )
        
        exercise3 = Exercise(
            name='DEADLIFTS',
            workout_id=test_workout.id,
            weight=150.0,
            reps='5',
            details='',
            include_details=True
        )
        
        db.session.add_all([exercise1, exercise2, exercise3])
        db.session.commit()
        
        print("=== Testing Exercise Completion Logic ===")
        print()
        
        # Test 1: Exercise with no weight should not be completed
        print("Test 1: Exercise with no weight")
        print(f"Exercise: {exercise1.name}")
        print(f"Weight: {exercise1.weight}")
        print(f"Should be completed: False")
        
        # Simulate template logic for exercise1
        has_logged_top_set_1 = False
        for session in test_user.workout_sessions:
            if session.workout_id == test_workout.id:
                for log in session.exercise_logs:
                    if log.exercise_name == exercise1.name and log.weight is not None and log.weight > 0:
                        has_logged_top_set_1 = True
        
        print(f"Actually completed: {has_logged_top_set_1}")
        print("✓ PASS" if not has_logged_top_set_1 else "✗ FAIL")
        print()
        
        # Test 2: Exercise with weight but no logged session should not be completed
        print("Test 2: Exercise with weight but no logged session")
        print(f"Exercise: {exercise2.name}")
        print(f"Weight: {exercise2.weight}")
        print(f"Should be completed: False (no logged session)")
        
        # Simulate template logic for exercise2
        has_logged_top_set_2 = False
        for session in test_user.workout_sessions:
            if session.workout_id == test_workout.id:
                for log in session.exercise_logs:
                    if log.exercise_name == exercise2.name and log.weight is not None and log.weight > 0:
                        has_logged_top_set_2 = True
        
        print(f"Actually completed: {has_logged_top_set_2}")
        print("✓ PASS" if not has_logged_top_set_2 else "✗ FAIL")
        print()
        
        # Test 3: Create a workout session with logged top set
        print("Test 3: Creating workout session with logged top set")
        workout_session = WorkoutSession(
            user_id=test_user.id,
            workout_id=test_workout.id
        )
        db.session.add(workout_session)
        db.session.commit()
        
        # Log exercise3 as completed with a top set
        exercise_log = ExerciseLog(
            session_id=workout_session.id,
            exercise_name=exercise3.name,
            weight=150.0,
            reps=5,
            details='Personal best',
            include_details=True
        )
        db.session.add(exercise_log)
        db.session.commit()
        
        print(f"Created session for workout: {test_workout.name}")
        print(f"Logged exercise: {exercise3.name} with weight: {exercise_log.weight}")
        print()
        
        # Test 4: Exercise with logged session should be completed
        print("Test 4: Exercise with logged top set")
        print(f"Exercise: {exercise3.name}")
        print(f"Should be completed: True (has logged session)")
        
        # Simulate template logic for exercise3
        has_logged_top_set_3 = False
        for session in test_user.workout_sessions:
            if session.workout_id == test_workout.id:
                for log in session.exercise_logs:
                    if log.exercise_name == exercise3.name and log.weight is not None and log.weight > 0:
                        has_logged_top_set_3 = True
        
        print(f"Actually completed: {has_logged_top_set_3}")
        print("✓ PASS" if has_logged_top_set_3 else "✗ FAIL")
        print()
        
        # Test 5: Progress calculation
        print("Test 5: Progress calculation")
        completed_count = 0
        total_count = len(test_workout.exercises)
        
        for exercise in test_workout.exercises:
            for session in test_user.workout_sessions:
                if session.workout_id == test_workout.id:
                    for log in session.exercise_logs:
                        if log.exercise_name == exercise.name and log.weight is not None and log.weight > 0:
                            completed_count += 1
                            break
        
        progress_percentage = ((completed_count / total_count * 100) if total_count > 0 else 0)
        
        print(f"Total exercises: {total_count}")
        print(f"Completed exercises: {completed_count}")
        print(f"Progress: {progress_percentage:.0f}%")
        print(f"Expected: 1 completed out of 3 (33%)")
        print("✓ PASS" if completed_count == 1 and abs(progress_percentage - 33) < 1 else "✗ FAIL")
        print()
        
        # Summary
        all_tests_passed = (
            not has_logged_top_set_1 and  # Test 1
            not has_logged_top_set_2 and  # Test 2
            has_logged_top_set_3 and      # Test 4
            completed_count == 1           # Test 5
        )
        
        print("=== Test Summary ===")
        if all_tests_passed:
            print("🎉 ALL TESTS PASSED!")
            print("Exercise completion logic is working correctly:")
            print("- Exercises without logged top sets are marked as pending")
            print("- Exercises with logged top sets are marked as completed")
            print("- Progress calculation reflects actual logged completions")
        else:
            print("❌ SOME TESTS FAILED!")
            print("The completion logic needs further review.")
        
        return all_tests_passed

if __name__ == '__main__':
    success = test_completion_logic()
    sys.exit(0 if success else 1)
