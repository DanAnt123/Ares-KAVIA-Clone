#!/usr/bin/env python3
"""
Test script to validate that the edit button functionality works correctly.
This tests the POST form submission from homepage to edit-workout route.
"""

import sys
import os
sys.path.insert(0, '.')

from website import create_app, db
from website.models import User, Workout, Exercise, Category
from flask import url_for
from werkzeug.security import generate_password_hash

def test_edit_button_functionality():
    """Test that the edit button form submission works correctly"""
    
    app = create_app()
    
    with app.app_context():
        # Clean up any existing data
        db.drop_all()
        db.create_all()
        
        # Create test user
        test_user = User(
            email='test@example.com',
            password=generate_password_hash('testpass123', method='pbkdf2')
        )
        db.session.add(test_user)
        db.session.commit()
        
        # Create test category
        test_category = Category(name='Test Category', description='Test description')
        db.session.add(test_category)
        db.session.commit()
        
        # Create test workout
        test_workout = Workout(
            name='Test Workout',
            description='Test Description',
            user_id=test_user.id,
            category_id=test_category.id
        )
        db.session.add(test_workout)
        db.session.commit()
        
        # Create test exercise
        test_exercise = Exercise(
            name='TEST EXERCISE',
            include_details=1,
            workout_id=test_workout.id,
            weight=100.0,
            details='Test details'
        )
        db.session.add(test_exercise)
        db.session.commit()
        
        print(f"✓ Created test data:")
        print(f"  - User: {test_user.email} (ID: {test_user.id})")
        print(f"  - Workout: {test_workout.name} (ID: {test_workout.id})")
        print(f"  - Exercise: {test_exercise.name}")
        
        # Test the edit-workout route functionality
        with app.test_client() as client:
            # Simulate login by setting session
            with client.session_transaction() as sess:
                sess['_user_id'] = str(test_user.id)
                sess['_fresh'] = True
            
            # Test GET request to homepage (should show workout)
            response = client.get('/')
            print(f"✓ Homepage GET status: {response.status_code}")
            
            if response.status_code == 200:
                homepage_content = response.get_data(as_text=True)
                
                # Check if the edit form is present
                if f'action="/edit-workout"' in homepage_content:
                    print("✓ Edit form found in homepage")
                else:
                    print("✗ Edit form NOT found in homepage")
                    return False
                
                # Check if workout ID is in the form
                if f'value="{test_workout.id}"' in homepage_content:
                    print(f"✓ Workout ID {test_workout.id} found in edit form")
                else:
                    print(f"✗ Workout ID {test_workout.id} NOT found in edit form")
                    return False
            
            # Test POST request to edit-workout (simulate clicking Edit button)
            print(f"\n📝 Testing POST to /edit-workout with workout ID {test_workout.id}")
            
            response = client.post('/edit-workout', data={
                'workout': str(test_workout.id)
            }, follow_redirects=False)
            
            print(f"✓ Edit-workout POST status: {response.status_code}")
            
            if response.status_code == 200:
                edit_content = response.get_data(as_text=True)
                
                # Check if we got the edit page with the correct workout
                if 'Edit Workout' in edit_content:
                    print("✓ Edit workout page loaded successfully")
                    
                    # Check if workout data is pre-filled
                    if test_workout.name in edit_content:
                        print(f"✓ Workout name '{test_workout.name}' found in edit form")
                    else:
                        print(f"✗ Workout name '{test_workout.name}' NOT found in edit form")
                        return False
                    
                    # Check if exercise data is present
                    if test_exercise.name in edit_content:
                        print(f"✓ Exercise name '{test_exercise.name}' found in edit form")
                    else:
                        print(f"✗ Exercise name '{test_exercise.name}' NOT found in edit form")
                        return False
                        
                    return True
                else:
                    print("✗ Edit workout page NOT loaded correctly")
                    print("Response content preview:", edit_content[:500])
                    return False
            else:
                print(f"✗ Unexpected status code: {response.status_code}")
                if response.location:
                    print(f"Redirect location: {response.location}")
                return False

if __name__ == '__main__':
    print("🧪 Testing Edit Button Functionality")
    print("=" * 50)
    
    try:
        success = test_edit_button_functionality()
        if success:
            print("\n🎉 ALL TESTS PASSED!")
            print("The edit button functionality is working correctly.")
        else:
            print("\n❌ SOME TESTS FAILED!")
            print("There are still issues with the edit button functionality.")
    except Exception as e:
        print(f"\n💥 TEST FAILED WITH EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
