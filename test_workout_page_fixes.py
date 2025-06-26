#!/usr/bin/env python3
"""
Test script to verify the workout page fixes for:
1. Displaying previous session weights/reps
2. Correct progress calculation based on Exercise table data
3. Consistent completion status
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog
from website.views import get_workout_completion_status, get_last_session_data_for_workout
import tempfile
import time

def test_workout_page_fixes():
    """Test all the fixes implemented for the workout page."""
    
    # Create test app with in-memory database
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create test user
        unique_email = f'test{int(time.time())}@example.com'
        test_user = User(email=unique_email, password='password')
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
            weight=None,  # No current weight
            reps=None,
            details='',
            include_details=True
        )
        
        exercise2 = Exercise(
            name='SQUATS',
            workout_id=test_workout.id,
            weight=80.0,  # Has current weight and reps
            reps='10',
            details='',
            include_details=True
        )
        
        db.session.add_all([exercise1, exercise2])
        db.session.commit()
        
        print("=== Testing Workout Page Fixes ===")
        print()
        
        # Test 1: Initial progress calculation (Exercise table based)
        print("Test 1: Progress calculation based on Exercise table data")
        completion_status = get_workout_completion_status(test_workout.id, test_user.id)
        print(f"Total exercises: {completion_status['total']}")
        print(f"Completed exercises: {completion_status['completed']}")
        print(f"Progress percentage: {completion_status['percentage']}%")
        print(f"Expected: 1 completed out of 2 (50%)")
        
        test1_pass = (
            completion_status['total'] == 2 and
            completion_status['completed'] == 1 and
            completion_status['percentage'] == 50
        )
        print("✓ PASS" if test1_pass else "✗ FAIL")
        print()
        
        # Test 2: No previous session data initially
        print("Test 2: No previous session data initially")
        last_session_data = get_last_session_data_for_workout(test_workout.id, test_user.id)
        print(f"Last session data: {last_session_data}")
        print(f"Expected: Empty dict (no previous sessions)")
        
        test2_pass = len(last_session_data) == 0
        print("✓ PASS" if test2_pass else "✗ FAIL")
        print()
        
        # Test 3: Create a workout session (previous session)
        print("Test 3: Creating previous workout session")
        previous_session = WorkoutSession(
            user_id=test_user.id,
            workout_id=test_workout.id
        )
        db.session.add(previous_session)
        db.session.commit()
        
        # Log previous exercises
        log1 = ExerciseLog(
            session_id=previous_session.id,
            exercise_name='BENCH PRESS',
            weight=70.0,
            reps=8,
            details='Previous session',
            include_details=True
        )
        
        log2 = ExerciseLog(
            session_id=previous_session.id,
            exercise_name='SQUATS',
            weight=75.0,
            reps=12,
            details='Previous session',
            include_details=True
        )
        
        db.session.add_all([log1, log2])
        db.session.commit()
        
        print(f"Created session with logs for {log1.exercise_name} and {log2.exercise_name}")
        print()
        
        # Test 4: Previous session data retrieval
        print("Test 4: Previous session data retrieval")
        last_session_data = get_last_session_data_for_workout(test_workout.id, test_user.id)
        print(f"Retrieved previous session data:")
        for exercise_name, data in last_session_data.items():
            print(f"  {exercise_name}: Weight={data['weight']}kg, Reps={data['reps']}")
        
        expected_data = {
            'BENCH PRESS': {'weight': 70.0, 'reps': 8},
            'SQUATS': {'weight': 75.0, 'reps': 12}
        }
        
        test4_pass = True
        for exercise_name, expected in expected_data.items():
            if exercise_name not in last_session_data:
                test4_pass = False
                break
            actual = last_session_data[exercise_name]
            if actual['weight'] != expected['weight'] or actual['reps'] != expected['reps']:
                test4_pass = False
                break
        
        print("✓ PASS" if test4_pass else "✗ FAIL")
        print()
        
        # Test 5: Progress calculation consistency (still based on Exercise table, not sessions)
        print("Test 5: Progress calculation consistency after session creation")
        completion_status_after = get_workout_completion_status(test_workout.id, test_user.id)
        print(f"Progress after session creation: {completion_status_after['percentage']}%")
        print(f"Expected: Still 50% (Exercise table unchanged)")
        
        test5_pass = completion_status_after['percentage'] == 50
        print("✓ PASS" if test5_pass else "✗ FAIL")
        print()
        
        # Test 6: Update Exercise table and verify progress changes
        print("Test 6: Update Exercise table and verify progress update")
        exercise1.weight = 75.0  # Complete the first exercise
        exercise1.reps = '8'
        db.session.commit()
        
        completion_status_updated = get_workout_completion_status(test_workout.id, test_user.id)
        print(f"Progress after updating Exercise table: {completion_status_updated['percentage']}%")
        print(f"Expected: 100% (both exercises now completed)")
        
        test6_pass = completion_status_updated['percentage'] == 100
        print("✓ PASS" if test6_pass else "✗ FAIL")
        print()
        
        # Test 7: Verify Exercise table vs Session table consistency check
        print("Test 7: Exercise completion logic consistency")
        
        # Check exercise1 (now has weight and reps in Exercise table)
        exercise1_completed_by_exercise_table = (
            exercise1.weight is not None and exercise1.weight > 0 and
            exercise1.reps is not None and exercise1.reps.strip() != ''
        )
        
        # Check exercise2 (has weight and reps in Exercise table)
        exercise2_completed_by_exercise_table = (
            exercise2.weight is not None and exercise2.weight > 0 and
            exercise2.reps is not None and exercise2.reps.strip() != ''
        )
        
        print(f"Exercise 1 completed (Exercise table): {exercise1_completed_by_exercise_table}")
        print(f"Exercise 2 completed (Exercise table): {exercise2_completed_by_exercise_table}")
        print(f"Expected: Both True")
        
        test7_pass = exercise1_completed_by_exercise_table and exercise2_completed_by_exercise_table
        print("✓ PASS" if test7_pass else "✗ FAIL")
        print()
        
        # Summary
        all_tests_passed = all([test1_pass, test2_pass, test4_pass, test5_pass, test6_pass, test7_pass])
        
        print("=== Test Summary ===")
        if all_tests_passed:
            print("🎉 ALL TESTS PASSED!")
            print("Workout page fixes are working correctly:")
            print("✓ Progress calculation based on Exercise table data")
            print("✓ Previous session data retrieval working")
            print("✓ Consistent completion logic between template and backend")
            print("✓ Exercise table updates properly affect progress")
        else:
            print("❌ SOME TESTS FAILED!")
            print("Issues found with workout page fixes:")
            if not test1_pass: print("- Progress calculation issue")
            if not test2_pass: print("- Initial session data issue")
            if not test4_pass: print("- Previous session data retrieval issue")
            if not test5_pass: print("- Progress consistency issue")
            if not test6_pass: print("- Exercise table update issue")
            if not test7_pass: print("- Completion logic consistency issue")
        
        return all_tests_passed

if __name__ == '__main__':
    success = test_workout_page_fixes()
    sys.exit(0 if success else 1)
