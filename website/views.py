from . import db
from .models import Workout, Exercise, WorkoutSession, ExerciseLog, Category
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func, desc, asc
from datetime import datetime, timedelta
from collections import defaultdict


# Define blueprint
views = Blueprint('views', __name__)


# PUBLIC_INTERFACE
def get_workout_completion_status(workout_id, user_id):
    """
    Calculate the completion status of a workout based on filled exercise data.
    
    Args:
        workout_id (int): ID of the workout
        user_id (int): ID of the user
        
    Returns:
        dict: Completion status with counts and percentage
    """
    try:
        workout = Workout.query.filter_by(id=workout_id, user_id=user_id).first()
        if not workout:
            return {"completed": 0, "total": 0, "percentage": 0}
        
        total_exercises = len(workout.exercises)
        completed_exercises = 0
        
        for exercise in workout.exercises:
            # An exercise is considered completed if it has both weight and reps
            if (exercise.weight is not None and exercise.weight > 0 and 
                exercise.reps is not None and exercise.reps.strip() != ''):
                completed_exercises += 1
        
        percentage = round((completed_exercises / total_exercises * 100) if total_exercises > 0 else 0)
        
        return {
            "completed": completed_exercises,
            "total": total_exercises,
            "percentage": percentage
        }
    except Exception as e:
        print(f"Error calculating completion status: {str(e)}")
        return {"completed": 0, "total": 0, "percentage": 0}


# PUBLIC_INTERFACE
def _create_top_set_log(exercise, workout_id, user_id):
    """
    Create a workout session log entry when a top set is completed (has both weight and reps).
    Uses a session-scoped lock to prevent duplicate entries.
    
    Args:
        exercise (Exercise): The exercise that was completed
        workout_id (int): ID of the workout
        user_id (int): ID of the user
    """
    try:
        from datetime import datetime, timedelta
        from sqlalchemy import and_, func
        
        # Start a transaction
        with db.session.begin_nested():
            # Use FOR UPDATE to lock the rows we're checking
            recent_threshold = datetime.utcnow() - timedelta(minutes=30)  # Reduced window to 30 minutes
            
            # Get most recent session with this exercise using a precise query
            existing_session = (db.session.query(WorkoutSession)
                .join(ExerciseLog)
                .filter(and_(
                    WorkoutSession.user_id == user_id,
                    WorkoutSession.workout_id == workout_id,
                    WorkoutSession.timestamp >= recent_threshold,
                    ExerciseLog.exercise_name == exercise.name,
                    ExerciseLog.weight == exercise.weight,  # Match exact weight
                    func.coalesce(ExerciseLog.reps, -1) == (int(exercise.reps) if exercise.reps and exercise.reps.isdigit() else -1)
                ))
                .with_for_update()
                .first())
            
            if existing_session:
                # Update existing log with the same values - idempotent operation
                existing_log = (db.session.query(ExerciseLog)
                    .filter(and_(
                        ExerciseLog.session_id == existing_session.id,
                        ExerciseLog.exercise_name == exercise.name
                    ))
                    .with_for_update()
                    .first())
                
                if existing_log:
                    # No need to update if values are the same
                    return
            
            # Create new session if no matching recent one exists
            session = WorkoutSession(user_id=user_id, workout_id=workout_id)
            db.session.add(session)
            db.session.flush()  # Get ID without committing
        
        # Create exercise log
        log = ExerciseLog(
            session_id=session.id,
            exercise_name=exercise.name,
            weight=exercise.weight,
            reps=int(exercise.reps) if exercise.reps and exercise.reps.isdigit() else None,
            details=exercise.details,
            include_details=exercise.include_details
        )
        db.session.add(log)
        db.session.commit()
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating top set log: {str(e)}")


def handle_complete_exercise_save(data):
    """
    Handle complete exercise save with validation.
    Only saves and marks as complete when all required fields are valid.
    
    Args:
        data (dict): JSON data containing complete exercise information
        
    Returns:
        flask.Response: JSON response with success/error status
    """
    
    try:
        workout_id = data.get("workout_id")
        exercise_id = data.get("exercise_id")
        exercise_data = data.get("exercise_data", {})
        
        # Validate required fields
        if not all([workout_id, exercise_id]):
            return jsonify({
                "success": False, 
                "error": "Missing required fields: workout_id or exercise_id"
            }), 400
        
        # Find exercise and verify ownership
        exercise = db.session.query(Exercise).join(Workout).filter(
            Exercise.id == exercise_id,
            Workout.id == workout_id,
            Workout.user_id == current_user.id
        ).first()
        
        if not exercise:
            return jsonify({
                "success": False, 
                "error": "Exercise not found or access denied"
            }), 404
        
        # Validate exercise data
        errors = []
        
        # Weight validation
        weight_str = exercise_data.get("weight", "").strip()
        if not weight_str:
            errors.append("Weight is required")
        else:
            try:
                weight_val = float(weight_str)
                if weight_val <= 0:
                    errors.append("Weight must be greater than 0")
                elif weight_val > 999.99:
                    errors.append("Weight cannot exceed 999.99 kg")
            except (ValueError, TypeError):
                errors.append("Invalid weight value. Must be a number.")
        
        # Reps validation
        reps_str = exercise_data.get("reps", "").strip()
        if not reps_str:
            errors.append("Reps is required")
        elif len(reps_str) > 20:
            errors.append("Reps value too long (max 20 characters)")
        
        # Details validation
        details_str = exercise_data.get("details", "").strip()
        if len(details_str) > 50:
            errors.append("Details too long (max 50 characters)")
        
        if errors:
            return jsonify({
                "success": False, 
                "errors": errors
            }), 400
        
        # Update exercise with validated data
        exercise.weight = float(weight_str)
        exercise.reps = reps_str
        exercise.details = details_str if details_str else ""
        
        # Save to database
        db.session.commit()
        
        # Create workout session log for this completed exercise
        _create_top_set_log(exercise, workout_id, current_user.id)
        
        return jsonify({
            "success": True, 
            "message": "Exercise saved and marked as complete",
            "exercise_id": exercise_id,
            "exercise_completed": True,
            "workout_id": workout_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False, 
            "error": f"Database error: {str(e)}"
        }), 500


def _create_workout_session(workout_id, exercises_data, user_id):
    """
    Unified function to create a workout session with exercise logs.
    Includes deduplication logic to prevent duplicate session creation.
    
    Args:
        workout_id (int): ID of the workout being completed
        exercises_data (list): List of exercise data dictionaries
        user_id (int): ID of the user completing the workout
        
    Returns:
        tuple: (success: bool, result: dict|str, status_code: int)
            - On success: (True, session_data_dict, 201)
            - On error: (False, error_message, error_code)
    """
    from datetime import datetime, timedelta
    from sqlalchemy import and_
    
    # Start transaction
    try:
        with db.session.begin_nested():
            # Validate workout exists and belongs to user
            workout = (Workout.query
                      .filter_by(id=workout_id, user_id=user_id)
                      .with_for_update()
                      .first())
            
            if not workout:
                return False, "Workout not found or access denied", 404
            
            if not exercises_data:
                return False, "No exercises provided", 400
            
            # Check for recent duplicate session
            recent_threshold = datetime.utcnow() - timedelta(minutes=5)
            recent_session = (WorkoutSession.query
                            .filter(and_(
                                WorkoutSession.user_id == user_id,
                                WorkoutSession.workout_id == workout_id,
                                WorkoutSession.timestamp >= recent_threshold
                            ))
                            .with_for_update()
                            .first())
            
            if recent_session:
                # Return existing session to prevent duplicate
                return True, {
                    "session_id": recent_session.id,
                    "timestamp": recent_session.timestamp.isoformat(),
                    "workout_id": recent_session.workout_id,
                    "workout_name": workout.name,
                    "exercises_logged": len(recent_session.exercise_logs),
                    "note": "Used existing recent session"
                }, 200
            
            # Create new session if no recent duplicate
            session = WorkoutSession(user_id=user_id, workout_id=workout_id)
            db.session.add(session)
            db.session.flush()  # Get ID without committing
            
    except Exception as e:
        db.session.rollback()
        return False, f"Database error: {str(e)}", 500
    
    # Initialize logs list outside try block
    logs = []
    try:
        exercises_logged = 0
        
        for idx, exercise_data in enumerate(exercises_data):
            # Extract and validate exercise name
            exercise_name = exercise_data.get("exercise_name", "").strip() if exercise_data.get("exercise_name") else ""
            if not exercise_name:
                # Rollback session if exercise name is missing
                db.session.delete(session)
                db.session.commit()
                return False, f"Missing exercise_name in entry {idx}", 400
            
            # Parse and validate numeric fields with error handling
            set_number = exercise_data.get("set_number")
            reps = exercise_data.get("reps")
            weight = exercise_data.get("weight")
            
            if set_number is not None:
                try:
                    set_number = int(set_number) if str(set_number).strip() else None
                except (ValueError, TypeError):
                    set_number = None
                    
            if reps is not None:
                try:
                    reps = int(reps) if str(reps).strip() else None
                except (ValueError, TypeError):
                    reps = None
                    
            if weight is not None:
                try:
                    weight = float(weight) if str(weight).strip() else None
                except (ValueError, TypeError):
                    weight = None
            
            # Create exercise log
            log = ExerciseLog(
                session_id=session.id,
                exercise_name=exercise_name,
                set_number=set_number,
                reps=reps,
                weight=weight,
                details=exercise_data.get("details"),
                include_details=exercise_data.get("include_details", False),
            )
            db.session.add(log)
            logs.append(log)
            exercises_logged += 1
        
        # Commit all changes
        db.session.commit()
        
        # Return success data
        return True, {
            "session_id": session.id,
            "timestamp": session.timestamp.isoformat(),
            "workout_id": session.workout_id,
            "workout_name": workout.name,
            "exercises_logged": exercises_logged,
        }, 201
        
    except Exception as e:
        db.session.rollback()
        return False, f"Error creating exercise logs: {str(e)}", 500
    
    # Return success data
    return True, {
        "session_id": session.id,
        "timestamp": session.timestamp.isoformat(),
        "workout_id": session.workout_id,
        "workout_name": workout.name,
        "exercises_logged": exercises_logged,
    }, 201


# PUBLIC_INTERFACE
@views.route("/api/progress/weight-progression/<exercise_name>", methods=["GET"])
@login_required
def get_weight_progression(exercise_name):
    """
    Get weight progression data for a specific exercise over time.
    Returns data suitable for chart visualization showing weight progression.
    
    Args:
        exercise_name (str): Name of the exercise to track
        
    Returns:
        JSON response with weight progression data points
    """
    try:
        # Decode the exercise name from URL encoding
        from urllib.parse import unquote
        exercise_name = unquote(exercise_name).strip()
        
        # Get all exercise logs for this exercise for the current user
        # Use exact match first, then fuzzy match if no results
        logs = (db.session.query(ExerciseLog, WorkoutSession.timestamp)
                .join(WorkoutSession)
                .filter(WorkoutSession.user_id == current_user.id)
                .filter(ExerciseLog.exercise_name == exercise_name)
                .filter(ExerciseLog.weight.isnot(None))
                .filter(ExerciseLog.weight > 0)  # Ensure positive weights
                .order_by(WorkoutSession.timestamp.asc())
                .all())
        
        # If no exact match, try case-insensitive search
        if not logs:
            logs = (db.session.query(ExerciseLog, WorkoutSession.timestamp)
                    .join(WorkoutSession)
                    .filter(WorkoutSession.user_id == current_user.id)
                    .filter(ExerciseLog.exercise_name.ilike(exercise_name))
                    .filter(ExerciseLog.weight.isnot(None))
                    .filter(ExerciseLog.weight > 0)
                    .order_by(WorkoutSession.timestamp.asc())
                    .all())
        
        # If still no match, try partial match
        if not logs:
            logs = (db.session.query(ExerciseLog, WorkoutSession.timestamp)
                    .join(WorkoutSession)
                    .filter(WorkoutSession.user_id == current_user.id)
                    .filter(ExerciseLog.exercise_name.ilike(f"%{exercise_name}%"))
                    .filter(ExerciseLog.weight.isnot(None))
                    .filter(ExerciseLog.weight > 0)
                    .order_by(WorkoutSession.timestamp.asc())
                    .all())
        
        if not logs:
            # Find all available exercises for debugging
            available_exercises = (db.session.query(ExerciseLog.exercise_name)
                                 .join(WorkoutSession)
                                 .filter(WorkoutSession.user_id == current_user.id)
                                 .filter(ExerciseLog.weight.isnot(None))
                                 .filter(ExerciseLog.weight > 0)
                                 .distinct()
                                 .all())
            
            return jsonify({
                "exercise_name": exercise_name,
                "data_points": [],
                "message": f"No weight data found for exercise '{exercise_name}'",
                "available_exercises": [ex[0] for ex in available_exercises],
                "debug_info": {
                    "searched_name": exercise_name,
                    "user_id": current_user.id,
                    "total_available": len(available_exercises)
                }
            })
        
        # Process all data points (not just daily max) to show progression
        data_points = []
        seen_dates = set()
        
        for log, timestamp in logs:
            date_key = timestamp.date().isoformat()
            formatted_date = timestamp.strftime("%b %d, %Y")
            
            # If we have multiple entries on the same date, take the highest weight
            existing_point = None
            for point in data_points:
                if point["date"] == date_key:
                    existing_point = point
                    break
            
            if existing_point:
                if log.weight > existing_point["weight"]:
                    existing_point["weight"] = float(log.weight)
                    existing_point["session_count"] = existing_point.get("session_count", 1) + 1
            else:
                data_points.append({
                    "date": date_key,
                    "weight": float(log.weight),
                    "formatted_date": formatted_date,
                    "session_count": 1,
                    "timestamp": timestamp.isoformat()
                })
        
        # Sort by date to ensure proper chronological order
        data_points.sort(key=lambda x: x["date"])
        
        # Calculate weight range and progression stats
        weights = [point["weight"] for point in data_points]
        min_weight = min(weights) if weights else 0
        max_weight = max(weights) if weights else 0
        
        # Calculate progression (difference between first and last)
        progression = 0
        if len(weights) >= 2:
            progression = weights[-1] - weights[0]
        
        return jsonify({
            "exercise_name": exercise_name,
            "data_points": data_points,
            "total_sessions": len(data_points),
            "total_logs": len(logs),
            "weight_range": {
                "min": min_weight,
                "max": max_weight
            },
            "progression_stats": {
                "total_progression": round(progression, 2),
                "progression_percentage": round((progression / weights[0] * 100) if weights and weights[0] > 0 else 0, 1),
                "average_weight": round(sum(weights) / len(weights), 2) if weights else 0
            }
        })
        
    except Exception as e:
        print(f"Error in get_weight_progression: {str(e)}")  # Debug logging
        return jsonify({
            "error": f"Failed to retrieve weight progression: {str(e)}",
            "exercise_name": exercise_name,
            "debug_info": {
                "user_authenticated": current_user.is_authenticated if current_user else False,
                "user_id": current_user.id if current_user and current_user.is_authenticated else None
            }
        }), 500


# PUBLIC_INTERFACE
@views.route("/api/progress/volume-trends/<int:workout_id>", methods=["GET"])
@login_required
def get_volume_trends(workout_id):
    """
    Get workout volume trends for a specific workout over time.
    Volume is calculated as total weight lifted (sets × reps × weight).
    
    Args:
        workout_id (int): ID of the workout to analyze
        
    Returns:
        JSON response with volume trend data points
    """
    try:
        # Verify workout belongs to current user
        workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
        if not workout:
            return jsonify({"error": "Workout not found or access denied"}), 404
        
        # Get all sessions for this workout
        sessions = (WorkoutSession.query
                   .filter_by(user_id=current_user.id, workout_id=workout_id)
                   .order_by(WorkoutSession.timestamp.asc())
                   .all())
        
        if not sessions:
            return jsonify({
                "workout_id": workout_id,
                "workout_name": workout.name,
                "data_points": [],
                "message": "No workout sessions found"
            })
        
        # Calculate volume for each session
        data_points = []
        for session in sessions:
            total_volume = 0
            total_sets = 0
            
            for log in session.exercise_logs:
                if log.weight and log.reps:
                    # Calculate volume for this set (weight × reps)
                    set_volume = log.weight * log.reps
                    total_volume += set_volume
                    total_sets += 1
            
            data_points.append({
                "date": session.timestamp.date().isoformat(),
                "volume": round(total_volume, 2),
                "total_sets": total_sets,
                "session_id": session.id,
                "formatted_date": session.timestamp.strftime("%b %d, %Y")
            })
        
        return jsonify({
            "workout_id": workout_id,
            "workout_name": workout.name,
            "data_points": data_points,
            "total_sessions": len(data_points),
            "volume_range": {
                "min": min(point["volume"] for point in data_points) if data_points else 0,
                "max": max(point["volume"] for point in data_points) if data_points else 0
            }
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Failed to retrieve volume trends: {str(e)}",
            "workout_id": workout_id
        }), 500


# PUBLIC_INTERFACE
@views.route("/api/progress/performance-summary", methods=["GET"])
@login_required
def get_performance_summary():
    """
    Get overall performance summary including key metrics across all workouts.
    Provides aggregate statistics suitable for dashboard display.
    
    Returns:
        JSON response with performance summary metrics
    """
    try:
        # Get date range filter from query parameters
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all sessions within the date range
        sessions = (WorkoutSession.query
                   .filter_by(user_id=current_user.id)
                   .filter(WorkoutSession.timestamp >= start_date)
                   .all())
        
        if not sessions:
            return jsonify({
                "period_days": days,
                "total_sessions": 0,
                "message": "No workout sessions found in the specified period"
            })
        
        # Calculate summary metrics
        total_sessions = len(sessions)
        total_exercises = sum(len(session.exercise_logs) for session in sessions)
        total_volume = 0
        exercise_frequency = defaultdict(int)
        workout_frequency = defaultdict(int)
        
        for session in sessions:
            # Track workout frequency
            if session.workout and session.workout.name:
                workout_frequency[session.workout.name] += 1
            
            for log in session.exercise_logs:
                # Track exercise frequency
                exercise_frequency[log.exercise_name] += 1
                
                # Calculate total volume
                if log.weight and log.reps:
                    total_volume += log.weight * log.reps
        
        # Find most frequent exercises and workouts
        top_exercises = sorted(exercise_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        top_workouts = sorted(workout_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Calculate averages
        avg_exercises_per_session = round(total_exercises / total_sessions, 1) if total_sessions > 0 else 0
        avg_volume_per_session = round(total_volume / total_sessions, 2) if total_sessions > 0 else 0
        
        # Calculate weekly frequency
        weeks_in_period = max(1, days / 7)
        sessions_per_week = round(total_sessions / weeks_in_period, 1)
        
        return jsonify({
            "period_days": days,
            "start_date": start_date.date().isoformat(),
            "end_date": datetime.utcnow().date().isoformat(),
            "total_sessions": total_sessions,
            "total_exercises": total_exercises,
            "total_volume": round(total_volume, 2),
            "averages": {
                "exercises_per_session": avg_exercises_per_session,
                "volume_per_session": avg_volume_per_session,
                "sessions_per_week": sessions_per_week
            },
            "top_exercises": [{"name": name, "frequency": freq} for name, freq in top_exercises],
            "top_workouts": [{"name": name, "frequency": freq} for name, freq in top_workouts],
            "unique_exercises": len(exercise_frequency),
            "unique_workouts": len(workout_frequency)
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Failed to retrieve performance summary: {str(e)}"
        }), 500


# PUBLIC_INTERFACE  
@views.route("/api/debug/weight-data", methods=["GET"])
@login_required  
def debug_weight_data():
    """
    Debug endpoint to show available weight data for troubleshooting.
    """
    try:
        # Get all exercise logs with weights for current user
        logs_with_weights = (db.session.query(
                ExerciseLog.exercise_name,
                ExerciseLog.weight,
                WorkoutSession.timestamp,
                ExerciseLog.id
            )
            .join(WorkoutSession)
            .filter(WorkoutSession.user_id == current_user.id)
            .filter(ExerciseLog.weight.isnot(None))
            .filter(ExerciseLog.weight > 0)
            .order_by(ExerciseLog.exercise_name, WorkoutSession.timestamp)
            .all())
        
        # Group by exercise
        exercise_data = defaultdict(list)
        for log in logs_with_weights:
            exercise_data[log.exercise_name].append({
                'weight': float(log.weight),
                'timestamp': log.timestamp.isoformat(),
                'log_id': log.id,
                'date': log.timestamp.date().isoformat()
            })
        
        # Calculate stats
        total_logs = len(logs_with_weights)
        unique_exercises = len(exercise_data)
        
        return jsonify({
            'user_id': current_user.id,
            'total_weight_logs': total_logs,
            'unique_exercises': unique_exercises,
            'exercises': dict(exercise_data),
            'exercise_names': list(exercise_data.keys()),
            'summary': {
                name: {
                    'count': len(data),
                    'weight_range': {
                        'min': min(d['weight'] for d in data),
                        'max': max(d['weight'] for d in data)
                    },
                    'date_range': {
                        'first': min(d['date'] for d in data),
                        'last': max(d['date'] for d in data)
                    }
                }
                for name, data in exercise_data.items()
            }
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Debug query failed: {str(e)}',
            'user_id': current_user.id if current_user and current_user.is_authenticated else None
        }), 500


# PUBLIC_INTERFACE  
@views.route("/api/debug/performance-metrics", methods=["GET"])
@login_required  
def debug_performance_metrics():
    """
    Debug endpoint to show performance metrics calculation breakdown for troubleshooting.
    """
    try:
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get raw session data
        all_sessions = (WorkoutSession.query
                       .filter_by(user_id=current_user.id)
                       .filter(WorkoutSession.timestamp >= start_date)
                       .order_by(WorkoutSession.timestamp.desc())
                       .all())
        
        # Analyze sessions for duplicates
        session_analysis = []
        duplicate_pairs = []
        session_threshold = timedelta(minutes=5)
        
        for i, session in enumerate(all_sessions):
            session_info = {
                'id': session.id,
                'workout_id': session.workout_id,
                'workout_name': session.workout.name if session.workout else 'Unknown',
                'timestamp': session.timestamp.isoformat(),
                'exercise_count': len(session.exercise_logs),
                'total_volume': sum(log.weight * log.reps for log in session.exercise_logs 
                                  if log.weight and log.reps),
                'is_potential_duplicate': False,
                'duplicate_of': None
            }
            
            # Check for potential duplicates
            for j, other_session in enumerate(all_sessions[:i]):
                if (session.workout_id == other_session.workout_id and 
                    abs((session.timestamp - other_session.timestamp).total_seconds()) < session_threshold.total_seconds()):
                    session_info['is_potential_duplicate'] = True
                    session_info['duplicate_of'] = other_session.id
                    duplicate_pairs.append({
                        'session1_id': other_session.id,
                        'session2_id': session.id,
                        'time_diff_seconds': abs((session.timestamp - other_session.timestamp).total_seconds()),
                        'same_workout': session.workout_id == other_session.workout_id
                    })
                    break
            
            session_analysis.append(session_info)
        
        # Get the corrected performance summary
        performance_summary = get_performance_summary()
        summary_data = performance_summary.get_json() if hasattr(performance_summary, 'get_json') else {}
        
        return jsonify({
            'debug_info': {
                'user_id': current_user.id,
                'period_days': days,
                'start_date': start_date.isoformat(),
                'analysis_timestamp': datetime.utcnow().isoformat()
            },
            'raw_data': {
                'total_sessions_found': len(all_sessions),
                'potential_duplicates': len([s for s in session_analysis if s['is_potential_duplicate']]),
                'duplicate_pairs': duplicate_pairs,
                'session_analysis': session_analysis
            },
            'corrected_metrics': summary_data,
            'recommendations': [
                'Check for rapid-fire session creation in the UI',
                'Consider implementing client-side duplicate prevention',
                'Review session creation API for race conditions',
                'Validate workout completion workflow'
            ]
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Debug metrics query failed: {str(e)}',
            'user_id': current_user.id if current_user and current_user.is_authenticated else None
        }), 500


# PUBLIC_INTERFACE
@views.route("/api/progress/exercise-frequency", methods=["GET"])
@login_required
def get_exercise_frequency():
    """
    Get exercise frequency data showing how often each exercise is performed.
    Returns data suitable for chart visualization (bar chart, pie chart, etc.).
    
    Returns:
        JSON response with exercise frequency data
    """
    try:
        # Get date range filter from query parameters
        days = request.args.get('days', 90, type=int)  # Default to 90 days
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get exercise frequency data
        frequency_data = (db.session.query(
                ExerciseLog.exercise_name,
                func.count(ExerciseLog.id).label('frequency'),
                func.count(func.distinct(WorkoutSession.id)).label('sessions'),
                func.avg(ExerciseLog.weight).label('avg_weight'),
                func.max(ExerciseLog.weight).label('max_weight')
            )
            .join(WorkoutSession)
            .filter(WorkoutSession.user_id == current_user.id)
            .filter(WorkoutSession.timestamp >= start_date)
            .group_by(ExerciseLog.exercise_name)
            .order_by(desc('frequency'))
            .all())
        
        if not frequency_data:
            return jsonify({
                "period_days": days,
                "exercises": [],
                "message": "No exercise data found in the specified period"
            })
        
        # Format data for chart consumption
        exercises = []
        total_frequency = sum(row.frequency for row in frequency_data)
        
        for row in frequency_data:
            percentage = round((row.frequency / total_frequency) * 100, 1) if total_frequency > 0 else 0
            
            exercises.append({
                "exercise_name": row.exercise_name,
                "frequency": row.frequency,
                "sessions": row.sessions,
                "percentage": percentage,
                "avg_weight": round(row.avg_weight, 2) if row.avg_weight else None,
                "max_weight": round(row.max_weight, 2) if row.max_weight else None
            })
        
        return jsonify({
            "period_days": days,
            "start_date": start_date.date().isoformat(),
            "end_date": datetime.utcnow().date().isoformat(),
            "exercises": exercises,
            "total_exercises": len(exercises),
            "total_frequency": total_frequency
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Failed to retrieve exercise frequency: {str(e)}"
        }), 500


# PUBLIC_INTERFACE
@views.route("/api/workout/history", methods=["GET"])
@login_required
def get_workout_history():
    """
    Retrieve all workout sessions for the current user, including all exercise logs.
    Returns JSON with session datetime, workout name, and exercise details for each session.
    """
    sessions = WorkoutSession.query.filter_by(user_id=current_user.id).order_by(WorkoutSession.timestamp.desc()).all()
    out = []
    for s in sessions:
        exercises = []
        for log in s.exercise_logs:
            exercises.append({
                "exercise_name": log.exercise_name,
                "set_number": log.set_number,
                "reps": log.reps,
                "weight": log.weight,
                "details": log.details,
                "include_details": log.include_details,
            })
        out.append({
            "session_id": s.id,
            "timestamp": s.timestamp.isoformat(),
            "workout_id": s.workout_id,
            "workout_name": s.workout.name if s.workout else "",
            "exercises": exercises,
        })
    return jsonify(out)


# PUBLIC_INTERFACE
@views.route("/api/workout/history/clear", methods=["DELETE"])
@login_required
def clear_workout_history():
    """
    Delete all workout sessions for the current user.
    This will cascade to delete all associated exercise logs.
    Returns JSON response with count of deleted sessions and success status.
    """
    try:
        # Get count of sessions before deletion for response
        session_count = WorkoutSession.query.filter_by(user_id=current_user.id).count()
        
        if session_count == 0:
            return jsonify({
                "success": True,
                "message": "No workout history to clear",
                "sessions_deleted": 0
            }), 200
        
        # Delete all workout sessions for the current user
        # This will cascade to delete all associated exercise logs
        deleted_count = WorkoutSession.query.filter_by(user_id=current_user.id).delete()
        
        # Only commit if there were actually records to delete
        if deleted_count > 0:
            db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Successfully cleared all workout history",
            "sessions_deleted": deleted_count
        }), 200
        
    except Exception as e:
        # Rollback transaction on error
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to clear workout history: {str(e)}"
        }), 500


# PUBLIC_INTERFACE
@views.route("/api/workout/history", methods=["POST"])
@login_required
def log_workout_session():
    """
    Record a new workout session for the current user. Expects JSON body:
    {
        "workout_id": int,
        "exercises": [
            {
                "exercise_name": str,
                "set_number": int (optional),
                "reps": int (optional),
                "weight": float (optional),
                "details": str (optional),
                "include_details": bool (optional)
            },
            ...
        ]
    }
    Returns: JSON with created session ID and timestamp.
    """
    data = request.get_json()
    workout_id = data.get("workout_id")
    exercises = data.get("exercises", [])
    
    if not workout_id:
        return jsonify({"error": "Missing workout_id"}), 400
    
    # Use unified workout completion function
    success, result, status_code = _create_workout_session(
        workout_id=workout_id,
        exercises_data=exercises,
        user_id=current_user.id
    )
    
    if success:
        return jsonify(result), status_code
    else:
        return jsonify({"error": result}), status_code


@views.route("/")
@login_required
def home():
    # Calculate total exercises across all user workouts
    total_exercises = 0
    for workout in current_user.workouts:
        total_exercises += len(workout.exercises)
    
    # Display home page to user
    return render_template("home.html", user=current_user, total_exercises=total_exercises)


@views.route("/workout", methods=["GET", "POST"])
@login_required
def workout():
    """
    Renders or updates the workout page. 
    Supports standard POST, in-page AJAX saves via JSON, robust validation, and feedback.
    """
    # AJAX/JSON save handler
    if request.method == "POST":
        is_json = request.is_json or "application/json" in request.headers.get("Content-Type", "")
        if is_json:
            data = request.get_json(force=True, silent=True) or {}
            
            # Handle complete exercise save (replaces auto-completion)
            if data.get("action") == "save_complete_exercise":
                return handle_complete_exercise_save(data)
            
            # Original bulk update logic
            workout_id = data.get("workout_id") or data.get("workout")
            weights = data.get("weights")
            details = data.get("details")
            # Validate
            errors = []
            if not workout_id:
                errors.append("Missing workout_id.")
            workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first() if workout_id else None
            if not workout:
                errors.append("Workout not found or access denied.")

            if weights is None or details is None or not isinstance(weights, list) or not isinstance(details, list):
                errors.append("Weights/details must be provided as lists.")
            if workout and (len(weights) != len(workout.exercises) or len(details) != len(workout.exercises)):
                errors.append("Mismatch between exercises and provided data.")

            # Inline robust validation for numeric weights:
            if not errors:
                for i, w in enumerate(weights):
                    if w is not None and str(w).strip() != "":
                        try:
                            float(w)
                        except Exception:
                            errors.append(f"Invalid weight value in entry {i+1}.")
            # Only allow saving with valid inputs
            if errors:
                return jsonify({"success": False, "errors": errors}), 400

            # Update DB
            for i, exercise in enumerate(workout.exercises):
                weight = weights[i]
                detail = details[i]
                if weight is not None and str(weight).strip() != "":
                    exercise.weight = float(weight)
                else:
                    exercise.weight = None
                exercise.details = detail
            db.session.commit()
            return jsonify({"success": True, "message": "Workout saved.", "workout_id": workout.id}), 200

        # Standard HTML form fallback
        request_type = request.form.get("request_type")
        if request_type == "save":
            workout_id = request.form.get("workout")
            weight_list = request.form.getlist("weight")
            details_list = request.form.getlist("details")

            workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
            if not workout:
                flash("Workout not found or access denied.", category="error")
                return render_template("workout.html", user=current_user)

            # Validation
            if len(weight_list) != len(workout.exercises) or len(details_list) != len(workout.exercises):
                flash("Mismatch between submitted data and the number of exercises.", category="error")
            else:
                error_indices = []
                for i, w in enumerate(weight_list):
                    if w:
                        try:
                            float(w)
                        except Exception:
                            error_indices.append(i + 1)
                if error_indices:
                    flash(f"Invalid weights at positions: {', '.join(map(str, error_indices))}.", category="error")
                else:
                    # Commit changes
                    for i, exercise in enumerate(workout.exercises):
                        # Accept blank = clear weight
                        w = weight_list[i]
                        exercise.weight = float(w) if w.strip() != "" else None
                        exercise.details = details_list[i]
                    db.session.commit()
                    flash("Workout saved successfully!", category="success")

        requested_workout = request.form.get("workout")
        
        return render_template(
            "workout.html",
            user=current_user,
            requested_workout=requested_workout,
            displayRequested="True"
        )

    # GET - Standard template rendering
    
    return render_template("workout.html", user=current_user)


def _get_top_set_for_exercise(exercise_logs):
    """
    Find the top set for an exercise based on weight (heaviest), then reps if weight is tied.
    
    Args:
        exercise_logs (list): List of ExerciseLog objects for the same exercise
        
    Returns:
        ExerciseLog: The exercise log representing the top set
    """
    if not exercise_logs:
        return None
    
    # Sort by weight (descending), then by reps (descending)
    def sort_key(log):
        weight = log.weight if log.weight is not None else 0
        reps = log.reps if log.reps is not None else 0
        return (-weight, -reps)
    
    return sorted(exercise_logs, key=sort_key)[0]


def _group_sessions_with_top_sets(sessions):
    """
    Group exercise logs by session and find top set for each exercise in each session.
    Ensures exercises are properly associated with their parent workout session.
    
    Args:
        sessions (list): List of WorkoutSession objects
        
    Returns:
        list: List of session dictionaries with top sets grouped by exercise
    """
    grouped_sessions = []
    
    for session in sessions:
        # Verify session has valid workout association
        if not session.workout_id or not session.workout:
            continue
            
        # Group exercise logs by exercise name within this specific session
        exercises_dict = {}
        for log in session.exercise_logs:
            # Ensure log belongs to this session
            if log.session_id != session.id:
                continue
                
            if log.exercise_name not in exercises_dict:
                exercises_dict[log.exercise_name] = []
            exercises_dict[log.exercise_name].append(log)
        
        # Find top set for each exercise in this session
        exercises_with_top_sets = []
        for exercise_name, logs in exercises_dict.items():
            top_set = _get_top_set_for_exercise(logs)
            if top_set:
                exercises_with_top_sets.append({
                    'exercise_name': exercise_name,
                    'top_set': top_set,
                    'total_sets': len(logs),
                    'session_id': session.id,  # Add session ID for verification
                    'workout_id': session.workout_id  # Add workout ID for verification
                })
        
        # Calculate session statistics
        total_weight = sum(
            log.weight for log in session.exercise_logs 
            if log.weight is not None and log.session_id == session.id
        )
        
        grouped_sessions.append({
            'session': session,
            'exercises': exercises_with_top_sets,
            'total_exercises': len(exercises_dict),
            'total_weight': total_weight,
            'total_sets': len([log for log in session.exercise_logs if log.session_id == session.id])
        })
    
    return grouped_sessions


# PUBLIC_INTERFACE
@views.route("/history")
@login_required
def history():
    """
    Renders the 'View your Progress' page showing workout sessions grouped by date as cards.
    Each card shows exercises with their top set (heaviest weight or most reps if tied).
    Supports enhanced filtering, sorting, and AJAX requests for real-time updates.
    """
    # Check if this is an AJAX request for data only
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return get_workout_history()
    
    # Fetch all workout sessions for current user, most recent first
    sessions = (
        WorkoutSession.query
        .filter_by(user_id=current_user.id)
        .order_by(WorkoutSession.timestamp.desc())
        .all()
    )
    
    # Collect all user's workouts for filter dropdown
    all_workouts = (
        Workout.query.filter_by(user_id=current_user.id)
        .order_by(Workout.name.asc())
        .all()
    )
    
    # Handle legacy workout_id filter parameter for backward compatibility
    selected_workout = None
    if "workout_id" in request.args and request.args.get("workout_id", "").isdigit():
        workout_filter = int(request.args["workout_id"])
        sessions = [s for s in sessions if s.workout_id == workout_filter]
        selected_workout = workout_filter

    # Group sessions with top sets for each exercise
    grouped_sessions = _group_sessions_with_top_sets(sessions)

    # Calculate additional statistics for enhanced UI
    total_exercises = sum(session_data['total_exercises'] for session_data in grouped_sessions)
    unique_workout_count = len(set(session.workout_id for session in sessions if session.workout_id))

    # Get unique exercise names across all sessions (normalized case)
    unique_exercises = {}
    for session in sessions:
        for log in session.exercise_logs:
            if log.exercise_name:
                exercise_name = log.exercise_name.strip().upper()
                if exercise_name not in unique_exercises:
                    unique_exercises[exercise_name] = {
                        'name': exercise_name,
                        'display_name': log.exercise_name.strip(),
                        'count': 1
                    }
                else:
                    unique_exercises[exercise_name]['count'] += 1
    
    # Convert to sorted list by display name
    unique_exercises = sorted(
        unique_exercises.values(),
        key=lambda x: x['display_name']
    )

    return render_template(
        "history.html",
        user=current_user,
        grouped_sessions=grouped_sessions,
        workouts=all_workouts,
        selected_workout=selected_workout,
        total_exercises=total_exercises,
        unique_workout_count=unique_workout_count,
        unique_exercises=unique_exercises,
    )


@views.route("/new-workout", methods=["GET", "POST"])
@login_required
def new_workout():
    # Ensure at least base categories exist (seed if needed)
    if Category.query.count() == 0:
        base_categories = [
            {"name": "Strength", "description": "Strength training workouts"},
            {"name": "Cardio", "description": "Cardiovascular exercises"},
            {"name": "Flexibility", "description": "Stretching and flexibility"},
            {"name": "Balance", "description": "Balance and stability"}
        ]
        for entry in base_categories:
            db.session.add(Category(name=entry["name"], description=entry["description"]))
        db.session.commit()

    categories = Category.query.order_by(Category.name.asc()).all()
    if request.method == "POST":
        # Collect form information
        workout_name = request.form.get("workout_name")
        workout_description = request.form.get("workout_description")
        exercise_names = request.form.getlist("exercise_name")
        include_details = request.form.getlist("include_details")

        # NEW: Category logic
        category_id = request.form.get("category_id")
        new_category_name = request.form.get("new_category_name")
        new_category_description = request.form.get("new_category_description")

        # Uppercase exercise names
        exercise_names = [exercise.upper() for exercise in exercise_names]

        # Form validation
        if not workout_name:
            flash("Must provide the workout name.", category="error")
        elif "" in exercise_names:
            flash("Must name all exercises.", category="error")
        elif not category_id and not new_category_name:
            flash("Must select or create a category.", category="error")
        else:
            # Handle category
            if new_category_name:
                # Create and/or get new category
                new_category = Category.query.filter_by(name=new_category_name).first()
                if not new_category:
                    new_category = Category(name=new_category_name, description=new_category_description)
                    db.session.add(new_category)
                    db.session.commit()
                cat_id = new_category.id
            else:
                # Use existing
                cat_id = int(category_id)

            # Add workout to database
            new_workout = Workout(
                user_id=current_user.id,
                name=workout_name,
                description=workout_description,
                category_id=cat_id
            )
            db.session.add(new_workout)
            db.session.commit()

            # Add exercises to database
            for i in range(len(exercise_names)):
                new_exercise = Exercise(
                    name=exercise_names[i],
                    include_details=int(include_details[i]),
                    workout_id=new_workout.id,
                    details="",
                )
                db.session.add(new_exercise)
                db.session.commit()

            # Redirect user to home page
            return redirect(url_for("views.home"))

    # Display form to user
    return render_template("new-workout.html", categories=categories)


@views.route("/edit-workout", methods=["GET", "POST"])
@login_required
def edit_workout():
    # Ensure at least base categories exist (seed if needed)
    if Category.query.count() == 0:
        base_categories = [
            {"name": "Strength", "description": "Strength training workouts"},
            {"name": "Cardio", "description": "Cardiovascular exercises"},
            {"name": "Flexibility", "description": "Stretching and flexibility"},
            {"name": "Balance", "description": "Balance and stability"}
        ]
        for entry in base_categories:
            db.session.add(Category(name=entry["name"], description=entry["description"]))
        db.session.commit()

    categories = Category.query.order_by(Category.name.asc()).all()
    
    if request.method == "POST":
        # Check request type
        request_type = request.form.get("request_type")

        if request_type == "save":
            # Collect form information
            workout_id = request.form.get("workout")
            workout_name = request.form.get("workout_name")
            workout_description = request.form.get("workout_description")
            exercise_names = request.form.getlist("exercise_name")
            include_details = request.form.getlist("include_details")
            weight_list = request.form.getlist("weight")
            details_list = request.form.getlist("details")

            # NEW: Category logic
            category_id = request.form.get("category_id")
            new_category_name = request.form.get("new_category_name")
            new_category_description = request.form.get("new_category_description")

            # Uppercase exercise names
            exercise_names = [exercise.upper() for exercise in exercise_names]

            # Form validation
            if not workout_name:
                flash("Must provide the workout name.", category="error")
            elif "" in exercise_names:
                flash("Must name all exercises.", category="error")
            elif not category_id and not new_category_name:
                flash("Must select or create a category.", category="error")
            else:
                # Handle category
                if new_category_name:
                    # Create and/or get new category
                    new_category = Category.query.filter_by(name=new_category_name).first()
                    if not new_category:
                        new_category = Category(name=new_category_name, description=new_category_description)
                        db.session.add(new_category)
                        db.session.commit()
                    cat_id = new_category.id
                else:
                    # Use existing
                    cat_id = int(category_id)

                # Query database for workout and verify ownership
                workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
                if not workout:
                    flash("Workout not found or access denied.", category="error")
                    return redirect(url_for("views.home"))

                # Delete existing exercises
                for exercise in workout.exercises:
                    db.session.delete(exercise)

                # Update workout information
                workout.name = workout_name
                workout.description = workout_description
                workout.category_id = cat_id

                # Commit workout changes
                db.session.commit()

                # Add exercises to database
                for i in range(len(exercise_names)):
                    include_detail_val = 1 if str(i) in include_details else 0
                    weight_val = None if weight_list[i] == "None" or not weight_list[i] else weight_list[i]
                    
                    try:
                        if weight_val is not None:
                            weight_val = float(weight_val)
                    except (ValueError, TypeError):
                        weight_val = None
                    
                    new_exercise = Exercise(
                        name=exercise_names[i],
                        include_details=include_detail_val,
                        workout_id=workout.id,
                        weight=weight_val,
                        details=details_list[i] if i < len(details_list) else "",
                    )
                    db.session.add(new_exercise)

                # Commit all changes
                db.session.commit()
                flash("Workout updated successfully!", category="success")

                # Redirect user to home page
                return redirect(url_for("views.home"))

        elif request_type == "cancel":
            # Redirect user to home page
            return redirect(url_for("views.home"))

        elif request_type == "delete":
            # Collect form information
            workout_id = request.form.get("workout")

            # Query database for workout and verify ownership
            workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
            if not workout:
                flash("Workout not found or access denied.", category="error")
                return redirect(url_for("views.home"))

            # Delete exercises
            for exercise in workout.exercises:
                db.session.delete(exercise)

            # Delete workout
            db.session.delete(workout)

            # Commit changes
            db.session.commit()
            flash("Workout deleted successfully.", category="success")

            # Redirect user to home page
            return redirect(url_for("views.home"))

        # Collect form information
        requested_workout = request.form.get("workout")

        # Display requested workout
        return render_template(
            "edit-workout.html",
            user=current_user,
            categories=categories,
            requested_workout=requested_workout,
            displayRequested="True",
        )

    # Display workout
    return render_template("edit-workout.html", user=current_user, categories=categories)


# PUBLIC_INTERFACE
@views.route("/duplicate-workout/<int:workout_id>", methods=["GET", "POST"])
@login_required
def duplicate_workout(workout_id):
    """
    Duplicate an existing workout by its ID and redirect to the home page.
    Args:
        workout_id (int): The ID of the workout to duplicate.
    Returns:
        Redirects to the 'views.home' route after duplicating the workout.
    """
    workout = Workout.query.get_or_404(workout_id)
    # Clone basic info
    new_workout = Workout(
        name=f"{workout.name} (Copy)",
        description=workout.description,
        user_id=current_user.id
    )
    db.session.add(new_workout)
    db.session.commit()
    # Optionally duplicate exercises (if using exercises table)
    original_exercises = Exercise.query.filter_by(workout_id=workout.id).all()
    for orig_ex in original_exercises:
        new_exercise = Exercise(
            name=orig_ex.name,
            include_details=orig_ex.include_details,
            workout_id=new_workout.id,
            weight=orig_ex.weight,
            details=orig_ex.details,
        )
        db.session.add(new_exercise)
    db.session.commit()

    flash('Workout duplicated successfully!', category='success')
    return redirect(url_for('views.home'))


# PUBLIC_INTERFACE
@views.route("/complete-workout/<int:workout_id>", methods=["POST"])
@login_required
def complete_workout(workout_id):
    """
    Complete a workout by logging exercise details and creating a workout session.
    Processes form data and converts it to the standard exercise data format.
    Args:
        workout_id (int): The ID of the workout to complete.
    Returns:
        Redirects to the workout page with a success message.
    """
    # Get workout to build exercise data structure
    workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
    if not workout:
        flash('Workout not found.', category='error')
        return redirect(url_for('views.workout'))
    
    # Process form data into standardized exercise data structure
    exercises_data = []
    for exercise in workout.exercises:
        # Extract form data for this exercise
        exercise_weight = request.form.get(f'exercise_{exercise.id}_weight')
        exercise_reps = request.form.get(f'exercise_{exercise.id}_reps')
        exercise_sets = request.form.get(f'exercise_{exercise.id}_sets')
        exercise_details = request.form.get(f'exercise_{exercise.id}_details')
        
        # Only include exercises that have at least some data
        if any([exercise_weight, exercise_reps, exercise_sets, exercise_details]):
            exercise_data = {
                "exercise_name": exercise.name,
                "weight": exercise_weight,
                "reps": exercise_reps,
                "set_number": exercise_sets,
                "details": exercise_details,
                "include_details": exercise.include_details
            }
            exercises_data.append(exercise_data)
    
    # Use unified workout completion function
    success, result, status_code = _create_workout_session(
        workout_id=workout_id,
        exercises_data=exercises_data,
        user_id=current_user.id
    )
    
    if success:
        exercises_logged = result.get('exercises_logged', 0)
        if exercises_logged > 0:
            flash(f'Workout completed! Logged {exercises_logged} exercises.', category='success')
        else:
            flash('Workout completed, but no exercise details were recorded.', category='info')
    else:
        flash(f'Error completing workout: {result}', category='error')
    
    return redirect(url_for('views.workout'))
