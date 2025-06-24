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
    # Create new session object
    session = WorkoutSession(user_id=current_user.id, workout_id=workout_id)
    db.session.add(session)
    db.session.commit()  # session.id now exists
    logs = []
    for item in exercises:
        log = ExerciseLog(
            session_id=session.id,
            exercise_name=item.get("exercise_name", ""),
            set_number=item.get("set_number"),
            reps=item.get("reps"),
            weight=item.get("weight"),
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
