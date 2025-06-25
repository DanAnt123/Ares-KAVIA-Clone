from . import db
from .models import Workout, Exercise, WorkoutSession, ExerciseLog
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user

# Define blueprint
views = Blueprint('views', __name__)


def _create_workout_session(workout_id, exercises_data, user_id):
    """
    Unified function to create a workout session with exercise logs.
    
    Args:
        workout_id (int): ID of the workout being completed
        exercises_data (list): List of exercise data dictionaries
        user_id (int): ID of the user completing the workout
        
    Returns:
        tuple: (success: bool, result: dict|str, status_code: int)
            - On success: (True, session_data_dict, 201)
            - On error: (False, error_message, error_code)
    """
    # Validate workout exists and belongs to user
    workout = Workout.query.filter_by(id=workout_id, user_id=user_id).first()
    if not workout:
        return False, "Workout not found or access denied", 404
    
    if not exercises_data:
        return False, "No exercises provided", 400
    
    # Create new session
    session = WorkoutSession(user_id=user_id, workout_id=workout_id)
    db.session.add(session)
    db.session.commit()  # Get session ID
    
    logs = []
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
    

# PUBLIC_INTERFACE
=======
    # Return success data
    return True, {
        "session_id": session.id,
        "timestamp": session.timestamp.isoformat(),
        "workout_id": session.workout_id,
        "workout_name": workout.name,
        "exercises_logged": exercises_logged,
    }, 201


# PUBLIC_INTERFACE
=======

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
    # Display home page to user
    return render_template("home.html", user=current_user)


@views.route("/workout", methods=["GET", "POST"])
@login_required
def workout():
    if request.method == "POST":
        # Check request type
        request_type = request.form.get("request_type")

        if request_type == "save":
            # Collect form information
            workout_id = request.form.get("workout")
            weight_list = request.form.getlist("weight")
            details_list = request.form.getlist("details")

            # Query database for workout
            workout = Workout.query.filter_by(id=workout_id).first()

            # Update workout
            for i in range(len(workout.exercises)):
                if weight_list[i]:
                    weight = float(weight_list[i])
                    workout.exercises[i].weight = weight
                else:
                    workout.exercises[i].weight = None
                details = details_list[i]
                workout.exercises[i].details = details
            db.session.commit()

        # Collect form information
        requested_workout = request.form.get("workout")

        # Display requested workout
        return render_template(
            "workout.html",
            user=current_user,
            requested_workout=requested_workout,
            displayRequested="True",
        )

    # Display workout
    return render_template("workout.html", user=current_user)


# PUBLIC_INTERFACE
@views.route("/history")
@login_required
def history():
    """
    Renders the 'View your Progress' page showing all past workout sessions and their details for the logged-in user.
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

    # Calculate additional statistics for enhanced UI
    total_exercises = sum(len(session.exercise_logs) for session in sessions)
    unique_workout_count = len(set(session.workout_id for session in sessions if session.workout_id))

    return render_template(
        "history.html",
        user=current_user,
        sessions=sessions,
        workouts=all_workouts,
        selected_workout=selected_workout,
        total_exercises=total_exercises,
        unique_workout_count=unique_workout_count,
    )

@views.route("/new-workout", methods=["GET", "POST"])
@login_required
def new_workout():
    if request.method == "POST":
        # Collect form information
        workout_name = request.form.get("workout_name")
        workout_description = request.form.get("workout_description")
        exercise_names = request.form.getlist("exercise_name")
        include_details = request.form.getlist("include_details")

        # Uppercase exercise names
        exercise_names = [exercise.upper() for exercise in exercise_names]

        # Ensure workout name was submitted
        if not workout_name:
            flash("Must provide the workout name.", category="error")

        # Ensure all exercises were named
        elif "" in exercise_names:
            flash("Must name all exercises.", category="error")

        else:
            # Add workout to database
            new_workout = Workout(
                user_id=current_user.id,
                name=workout_name,
                description=workout_description,
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
    return render_template("new-workout.html")


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
