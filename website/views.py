from . import db
from .models import Workout, Exercise, WorkoutSession, ExerciseLog, Category
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user

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
def get_last_session_data_for_workout(workout_id, user_id):
    """
    Get the last session data for each exercise in a workout.
    Returns previous weights/reps to display to user.
    
    Args:
        workout_id (int): ID of the workout
        user_id (int): ID of the user
        
    Returns:
        dict: Exercise names mapped to their last session data
    """
    try:
        # Get the most recent workout session for this workout
        latest_session = (WorkoutSession.query
                         .filter_by(user_id=user_id, workout_id=workout_id)
                         .order_by(WorkoutSession.timestamp.desc())
                         .first())
        
        if not latest_session:
            return {}
        
        # Get all exercise logs from the latest session
        exercise_data = {}
        for log in latest_session.exercise_logs:
            exercise_data[log.exercise_name] = {
                'weight': log.weight,
                'reps': log.reps,
                'details': log.details,
                'timestamp': latest_session.timestamp
            }
        
        return exercise_data
        
    except Exception as e:
        print(f"Error getting last session data: {str(e)}")
        return {}


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
        
        # Commit the transaction (Flask-SQLAlchemy handles transaction automatically)
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
        
        # Get last session data for all user workouts
        last_session_data = {}
        for user_workout in current_user.workouts:
            last_session_data[user_workout.id] = get_last_session_data_for_workout(user_workout.id, current_user.id)
        
        return render_template(
            "workout.html",
            user=current_user,
            requested_workout=requested_workout,
            displayRequested="True",
            last_session_data=last_session_data
        )

    # GET - Standard template rendering (removed AJAX progress requests)
    
    # GET - Get last session data for all user workouts
    last_session_data = {}
    for user_workout in current_user.workouts:
        last_session_data[user_workout.id] = get_last_session_data_for_workout(user_workout.id, current_user.id)
    
    return render_template("workout.html", user=current_user, last_session_data=last_session_data)


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
    
    Args:
        sessions (list): List of WorkoutSession objects
        
    Returns:
        list: List of session dictionaries with top sets grouped by exercise
    """
    grouped_sessions = []
    
    for session in sessions:
        # Group exercise logs by exercise name
        exercises_dict = {}
        for log in session.exercise_logs:
            if log.exercise_name not in exercises_dict:
                exercises_dict[log.exercise_name] = []
            exercises_dict[log.exercise_name].append(log)
        
        # Find top set for each exercise
        exercises_with_top_sets = []
        for exercise_name, logs in exercises_dict.items():
            top_set = _get_top_set_for_exercise(logs)
            if top_set:
                exercises_with_top_sets.append({
                    'exercise_name': exercise_name,
                    'top_set': top_set,
                    'total_sets': len(logs)
                })
        
        # Calculate session statistics
        total_weight = sum(
            log.weight for log in session.exercise_logs 
            if log.weight is not None
        )
        
        grouped_sessions.append({
            'session': session,
            'exercises': exercises_with_top_sets,
            'total_exercises': len(exercises_dict),
            'total_weight': total_weight,
            'total_sets': len(session.exercise_logs)
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

            # Uppercase exercise names
            exercise_names = [exercise.upper() for exercise in exercise_names]

            # Ensure workout name was submitted
            if not workout_name:
                flash("Must provide the workout name.", category="error")

            # Ensure all exercises were named
            elif "" in exercise_names:
                flash("Must name all exercises.", category="error")

            else:
                # Query database for workout
                workout = Workout.query.filter_by(id=workout_id).first()

                # Delete exercises
                for exercise in workout.exercises:
                    db.session.delete(exercise)

                # Delete workout
                db.session.delete(workout)

                # Commit changes
                db.session.commit()

                # Add workout to database
                new_workout = Workout(
                    id=workout_id,
                    user_id=current_user.id,
                    name=workout_name,
                    description=workout_description,
                )
                db.session.add(new_workout)
                db.session.commit()

                # Add exercises to database
                for i in range(len(exercise_names)):
                    if weight_list[i] == "None":
                        new_exercise = Exercise(
                            name=exercise_names[i],
                            include_details=int(include_details[i]),
                            workout_id=new_workout.id,
                            details=details_list[i],
                        )
                    else:
                        new_exercise = Exercise(
                            name=exercise_names[i],
                            include_details=int(include_details[i]),
                            workout_id=new_workout.id,
                            weight=weight_list[i],
                            details=details_list[i],
                        )
                    db.session.add(new_exercise)
                    db.session.commit()

                # Redirect user to home page
                return redirect(url_for("views.home"))

        elif request_type == "cancel":
            # Redirect user to home page
            return redirect(url_for("views.home"))

        elif request_type == "delete":
            # Collect form information
            workout_id = request.form.get("workout")

            # Query database for workout
            workout = Workout.query.filter_by(id=workout_id).first()

            # Delete exercises
            for exercise in workout.exercises:
                db.session.delete(exercise)

            # Delete workout
            db.session.delete(workout)

            # Commit changes
            db.session.commit()

            # Redirect user to home page
            return redirect(url_for("views.home"))

        # Collect form information
        requested_workout = request.form.get("workout")

        # Display requested workout
        return render_template(
            "edit-workout.html",
            user=current_user,
            requested_workout=requested_workout,
            displayRequested="True",
        )

    # Display workout
    return render_template("edit-workout.html", user=current_user)


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
