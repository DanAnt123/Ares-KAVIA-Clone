from . import db
from .models import Workout, Exercise, WorkoutSession, ExerciseLog
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user

# Define blueprint
views = Blueprint('views', __name__)

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
    if not workout_id or not exercises:
        return jsonify({"error": "Missing workout_id or exercises"}), 400
    
    # Defensive: Is the referenced workout valid and does it belong to this user?
    workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
    if not workout:
        return jsonify({"error": "Workout not found"}), 404

    # Create new session object
    session = WorkoutSession(user_id=current_user.id, workout_id=workout_id)
    db.session.add(session)
    db.session.commit()  # session.id now exists
    logs = []
    for idx, item in enumerate(exercises):
        # Minimal validation for exercise entry
        exercise_name = item.get("exercise_name", "").strip() if item.get("exercise_name") else ""
        if not exercise_name:
            return jsonify({"error": f"Missing exercise_name in entry {idx}"}), 400
        set_number = item.get("set_number")
        reps = item.get("reps")
        weight = item.get("weight")
        if set_number is not None:
            try:
                set_number = int(set_number)
            except Exception:
                set_number = None
        if reps is not None:
            try:
                reps = int(reps)
            except Exception:
                reps = None
        if weight is not None:
            try:
                weight = float(weight)
            except Exception:
                weight = None
        log = ExerciseLog(
            session_id=session.id,
            exercise_name=exercise_name,
            set_number=set_number,
            reps=reps,
            weight=weight,
            details=item.get("details"),
            include_details=item.get("include_details"),
        )
        db.session.add(log)
        logs.append(log)
    db.session.commit()
    return jsonify({
        "session_id": session.id,
        "timestamp": session.timestamp.isoformat(),
        "workout_id": session.workout_id,
        "exercises_logged": len(logs),
    }), 201


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
    """
    # Fetch all workout sessions for current user, most recent first
    from flask import Markup
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
    # If a filter is requested (by workout_id)
    selected_workout = None
    workout_filter = None
    if "workout_id" in request.args and request.args.get("workout_id", "").isdigit():
        workout_filter = int(request.args["workout_id"])
        sessions = [s for s in sessions if s.workout_id == workout_filter]
        selected_workout = workout_filter
    else:
        workout_filter = None

    return render_template(
        "history.html",
        user=current_user,
        sessions=sessions,
        workouts=all_workouts,
        selected_workout=selected_workout,
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
    Args:
        workout_id (int): The ID of the workout to complete.
    Returns:
        Redirects to the workout page with a success message.
    """
    workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
    if not workout:
        flash('Workout not found.', category='error')
        return redirect(url_for('views.workout'))
    
    # Create a new workout session
    session = WorkoutSession(user_id=current_user.id, workout_id=workout_id)
    db.session.add(session)
    db.session.commit()
    
    # Process exercise details from form
    exercises_logged = 0
    for exercise in workout.exercises:
        exercise_details = request.form.get(f'exercise_{exercise.id}_details')
        if exercise_details and exercise_details.strip():
            # Create exercise log entry
            log = ExerciseLog(
                session_id=session.id,
                exercise_name=exercise.name,
                details=exercise_details.strip(),
                include_details=exercise.include_details
            )
            db.session.add(log)
            exercises_logged += 1
    
    db.session.commit()
    
    if exercises_logged > 0:
        flash(f'Workout completed! Logged {exercises_logged} exercises.', category='success')
    else:
        flash('Workout completed, but no exercise details were recorded.', category='info')
    
    return redirect(url_for('views.workout'))
