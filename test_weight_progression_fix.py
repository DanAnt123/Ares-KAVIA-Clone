#!/usr/bin/env python3
"""
Test script to validate weight progression chart fix.
This script will test the API endpoint and verify it returns multiple data points.
"""

import requests
import json
from datetime import datetime, timedelta

def test_weight_progression_api():
    """Test the weight progression API endpoint"""
    base_url = "http://localhost:5000"
    
    # Test debug endpoint first
    print("Testing debug endpoint...")
    try:
        response = requests.get(f"{base_url}/api/debug/weight-data")
        if response.status_code == 200:
            debug_data = response.json()
            print(f"✓ Debug endpoint working")
            print(f"  Total weight logs: {debug_data.get('total_weight_logs', 0)}")
            print(f"  Unique exercises: {debug_data.get('unique_exercises', 0)}")
            
            if debug_data.get('exercise_names'):
                print(f"  Available exercises: {debug_data['exercise_names'][:5]}")
                
                # Test weight progression for first available exercise
                test_exercise = debug_data['exercise_names'][0]
                print(f"\nTesting weight progression for: {test_exercise}")
                
                prog_response = requests.get(f"{base_url}/api/progress/weight-progression/{test_exercise}")
                if prog_response.status_code == 200:
                    prog_data = prog_response.json()
                    data_points = prog_data.get('data_points', [])
                    print(f"✓ Weight progression API working")
                    print(f"  Data points returned: {len(data_points)}")
                    
                    if len(data_points) > 1:
                        print("✓ Multiple data points - chart should show trend line")
                        for i, point in enumerate(data_points[:3]):
                            print(f"    Point {i+1}: {point['formatted_date']} - {point['weight']}kg")
                        if len(data_points) > 3:
                            print(f"    ... and {len(data_points) - 3} more points")
                    elif len(data_points) == 1:
                        print("⚠ Only one data point - chart will show single point")
                        print(f"    Point: {data_points[0]['formatted_date']} - {data_points[0]['weight']}kg")
                    else:
                        print("✗ No data points returned")
                        
                else:
                    print(f"✗ Weight progression API failed: {prog_response.status_code}")
                    print(f"  Response: {prog_response.text}")
            else:
                print("⚠ No exercises with weight data found")
        else:
            print(f"✗ Debug endpoint failed: {response.status_code}")
            print(f"  Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("✗ Could not connect to server. Make sure Flask app is running on localhost:5000")
    except Exception as e:
        print(f"✗ Test failed with error: {str(e)}")

if __name__ == "__main__":
    print("Weight Progression Chart Fix - Test Script")
    print("=" * 50)
    test_weight_progression_api()
    print("\nTest completed!")
