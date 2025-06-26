#!/usr/bin/env python3
"""
Integration test to verify the complete workflow of exercise completion.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from website import create_app, db
from website.models import User, Workout, Exercise, WorkoutSession, ExerciseLog
import json
import time

def test_integration_workflow():
    """Test the complete workflow from empty exercise to completed status."""
    
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            
            # Create test user
            test_user = User(email=f'integration{int(time.time())}@example.com', password='password')
            db.session.add(test_user)
            db.session.commit()
            
            # Create test workout with multiple exercises
            test_workout = Workout(
                name='Full Workout',
                description='Complete integration test',
                user_id=test_user.id
            )
            db.session.add(test_workout)
            db.session.commit()
            
            # Create exercises
            exercises = [
                Exercise(name='BENCH PRESS', workout_id=test_workout.id, weight=None, reps=None, details='', include_details=True),
                Exercise(name='SQUATS', workout_id=test_workout.id, weight=None, reps=None, details='', include_details=True),
                Exercise(name='DEADLIFTS', workout_id=test_workout.id, weight=None, reps=None, details='', include_details=True)
            ]
            
            for exercise in exercises:
                db.session.add(exercise)
            db.session.commit()
            
            print("=== Integration Test: Complete Workout Flow ===")
            print()
            
            # Mock login
            with client.session_transaction() as sess:
                sess['_user_id'] = str(test_user.id)
                sess['_fresh'] = True
            
            # Initial state: No exercises should be completed
            print("Step 1: Initial state - no exercises completed")
            completed_count = count_completed_exercises(test_user, test_workout)
            print(f"Completed exercises: {completed_count}/3")
            print("✓ PASS" if completed_count == 0 else "✗ FAIL")
            print()
            
            # Step 2: Add weight to first exercise (no reps yet)
            print("Step 2: Add weight to BENCH PRESS (no reps)")
            response = client.post('/workout', 
                json={
                    'action': 'update_single_field',
                    'workout_id': test_workout.id,
                    'exercise_id': exercises[0].id,
                    'field_type': 'weight',
                    'value': '80.0'
                },
                headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
            )
            
            data = response.get_json()
            print(f"Weight saved: {data.get('success', False)}")
            print(f"Top set logged: {data.get('top_set_logged', False)}")
            
            completed_count = count_completed_exercises(test_user, test_workout)
            print(f"Completed exercises: {completed_count}/3 (should still be 0)")
            print("✓ PASS" if completed_count == 0 else "✗ FAIL")
            print()
            
            # Step 3: Add reps to complete the top set
            print("Step 3: Add reps to BENCH PRESS (complete top set)")
            response = client.post('/workout', 
                json={
                    'action': 'update_single_field',
                    'workout_id': test_workout.id,
                    'exercise_id': exercises[0].id,
                    'field_type': 'reps',
                    'value': '8'
                },
                headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
            )
            
            data = response.get_json()
            print(f"Reps saved: {data.get('success', False)}")
            print(f"Top set logged: {data.get('top_set_logged', False)}")
            
            completed_count = count_completed_exercises(test_user, test_workout)
            print(f"Completed exercises: {completed_count}/3 (should be 1)")
            print("✓ PASS" if completed_count == 1 else "✗ FAIL")
            print()
            
            # Step 4: Complete second exercise (weight and reps in sequence)
            print("Step 4: Complete SQUATS (weight + reps)")
            
            # Add weight
            client.post('/workout', 
                json={
                    'action': 'update_single_field',
                    'workout_id': test_workout.id,
                    'exercise_id': exercises[1].id,
                    'field_type': 'weight',
                    'value': '120.0'
                },
                headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
            )
            
            # Add reps
            response = client.post('/workout', 
                json={
                    'action': 'update_single_field',
                    'workout_id': test_workout.id,
                    'exercise_id': exercises[1].id,
                    'field_type': 'reps',
                    'value': '5'
                },
                headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
            )
            
            completed_count = count_completed_exercises(test_user, test_workout)
            print(f"Completed exercises: {completed_count}/3 (should be 2)")
            print("✓ PASS" if completed_count == 2 else "✗ FAIL")
            print()
            
            # Step 5: Add only reps to third exercise (no weight)
            print("Step 5: Add only reps to DEADLIFTS (no weight)")
            response = client.post('/workout', 
                json={
                    'action': 'update_single_field',
                    'workout_id': test_workout.id,
                    'exercise_id': exercises[2].id,
                    'field_type': 'reps',
                    'value': '3'
                },
                headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
            )
            
            completed_count = count_completed_exercises(test_user, test_workout)
            print(f"Completed exercises: {completed_count}/3 (should still be 2)")
            print("✓ PASS" if completed_count == 2 else "✗ FAIL")
            print()
            
            # Step 6: Complete the workout
            print("Step 6: Complete DEADLIFTS with weight")
            response = client.post('/workout', 
                json={
                    'action': 'update_single_field',
                    'workout_id': test_workout.id,
                    'exercise_id': exercises[2].id,
                    'field_type': 'weight',
                    'value': '150.0'
                },
                headers={'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'}
            )
            
            completed_count = count_completed_exercises(test_user, test_workout)
            print(f"Completed exercises: {completed_count}/3 (should be 3)")
            print("✓ PASS" if completed_count == 3 else "✗ FAIL")
            print()
            
            # Step 7: Verify workout sessions
            print("Step 7: Verify workout sessions created")
            sessions = WorkoutSession.query.filter_by(user_id=test_user.id, workout_id=test_workout.id).all()
            total_logs = sum(len(session.exercise_logs) for session in sessions)
            
            print(f"Workout sessions: {len(sessions)}")
            print(f"Total exercise logs: {total_logs}")
            print(f"Expected: 1 session with 3 logs")
            print("✓ PASS" if len(sessions) == 1 and total_logs == 3 else "✗ FAIL")
            print()
            
            # Final verification
            print("=== Final Verification ===")
            progress_percentage = (completed_count / 3 * 100) if 3 > 0 else 0
            print(f"Workout progress: {progress_percentage:.0f}%")
            print(f"All exercises completed: {completed_count == 3}")
            print(f"Proper session tracking: {len(sessions) == 1 and total_logs == 3}")
            
            all_tests_passed = (
                completed_count == 3 and
                len(sessions) == 1 and
                total_logs == 3 and
                progress_percentage == 100
            )
            
            if all_tests_passed:
                print("\n🎉 INTEGRATION TEST PASSED!")
                print("✅ Exercise completion logic working correctly")
                print("✅ Top set logging functioning properly") 
                print("✅ Progress tracking accurate")
                print("✅ Workflow from empty to completed exercises verified")
            else:
                print("\n❌ INTEGRATION TEST FAILED!")
                
            return all_tests_passed

def count_completed_exercises(user, workout):
    """Count exercises with logged top sets using template logic."""
    completed_count = 0
    for exercise in workout.exercises:
        for session in user.workout_sessions:
            if session.workout_id == workout.id:
                for log in session.exercise_logs:
                    if log.exercise_name == exercise.name and log.weight is not None and log.weight > 0:
                        completed_count += 1
                        break
    return completed_count

if __name__ == '__main__':
    success = test_integration_workflow()
    sys.exit(0 if success else 1)
