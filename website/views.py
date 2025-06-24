from . import db
from .models import Workout, Exercise, Category, WorkoutSession, ExerciseSession
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify
from flask_login import login_required, current_user

# Define blueprint
views = Blueprint('views', __name__)

# PUBLIC_INTERFACE
@views.route("/duplicate-workout/<int:workout_id>", methods=["GET", "POST"])
@login_required
def duplicate_workout(workout_id):
    """
    Duplicates an existing workout along with its exercises for the current user,
    allowing renaming and modification before creation.
    - GET: Shows the duplication form pre-filled with workout/exercise info.
    - POST: Creates a new workout for the user, copying exercises.
    """
    from sqlalchemy.exc import SQLAlchemyError

    # Fetch the original workout and its exercises
    orig_workout = Workout.query.filter_by(id=workout_id).first()
    if not orig_workout:
        flash("The workout you are trying to duplicate does not exist.", category="error")
        return redirect(url_for("views.home"))

    categories = Category.query.all()

    if request.method == "POST":
        workout_name = request.form.get("workout_name")
        workout_description = request.form.get("workout_description")
        category_id = request.form.get("category_id")
        new_category_name = request.form.get("new_category_name")
        new_category_description = request.form.get("new_category_description")
        exercise_names = request.form.getlist("exercise_name")
        include_details = request.form.getlist("include_details")
        exercise_sets = request.form.getlist("exercise_sets")
        exercise_reps = request.form.getlist("exercise_reps")
        exercise_weights = request.form.getlist("exercise_weight")
        
        # If needed, handle category creation inline
        category = None
        if new_category_name:
            category = get_or_create_category(new_category_name, new_category_description)
            category_id = category.id
        elif category_id:
            category = Category.query.filter_by(id=category_id).first()
        else:
            category = None

        exercise_names = [exercise.upper() for exercise in exercise_names]

        if not workout_name:
            flash("Must provide a workout name.", category="error")
        elif "" in exercise_names:
            flash("Must name all exercises.", category="error")
        elif not category:
            flash("Please choose or create a category.", category="error")
        else:
            try:
                new_workout = Workout(
                    user_id=current_user.id,
                    name=workout_name,
                    description=workout_description,
                    category_id=category.id if category else None,
                )
                db.session.add(new_workout)
                db.session.commit()
                # Copy exercises based on edited names/fields, not blindly from original
                for i in range(len(exercise_names)):
                    # Avoid IndexError if include_details is missing or malformed
                    include_flag = int(include_details[i]) if i < len(include_details) and include_details[i] not in [None, ""] else 0
                    
                    # Get tracking data if available
                    sets_value = None
                    reps_value = None
                    weight_value = None
                    
                    if i < len(exercise_sets) and exercise_sets[i]:
                        try:
                            sets_value = int(exercise_sets[i])
                        except (ValueError, TypeError):
                            sets_value = None
                    
                    if i < len(exercise_reps) and exercise_reps[i]:
                        reps_value = exercise_reps[i]
                    
                    if i < len(exercise_weights) and exercise_weights[i]:
                        try:
                            weight_value = float(exercise_weights[i])
                        except (ValueError, TypeError):
                            weight_value = None
                    
                    new_exercise = Exercise(
                        name=exercise_names[i],
                        include_details=include_flag,
                        workout_id=new_workout.id,
                        sets=sets_value,
                        reps=reps_value,
                        weight=weight_value,
                        details="",  # Start details blank
                    )
                    db.session.add(new_exercise)
                db.session.commit()
                flash("Workout duplicated successfully!", category="success")
                return redirect(url_for("views.home"))
            except Exception as e:
                db.session.rollback()
                flash("Database error: " + str(e), category="error")
        # On failure, fall through and re-display form (errors shown via flash)
        # Repopulate form values.
        return render_template(
            "new-workout.html",
            categories=categories,
            workout_name=workout_name,
            workout_description=workout_description,
            exercise_names=exercise_names,
            include_details=include_details,
            duplicate_mode=True,  # Custom flag for template if needed
        )

    # For GET, show the fillable form with data from orig_workout
    # Prefill values: name (suffix " (copy)" or similar), desc, exercises list
    prefilled_name = orig_workout.name[:7] + " (Copy)" if len(orig_workout.name) <= 7 else orig_workout.name[:9] + " (C)" # 12 chars max
    prefilled_name = prefilled_name[:12]
    exercises = orig_workout.exercises
    exercise_names = [e.name for e in exercises]
    include_details = [int(e.include_details) for e in exercises]

    return render_template(
        "new-workout.html",
        categories=categories,
        workout_name=prefilled_name,
        workout_description=orig_workout.description,
        exercise_names=exercise_names,
        include_details=include_details,
        duplicate_mode=True,
    )

# PUBLIC_INTERFACE
def get_or_create_category(name, description=None):
    """
    Retrieves or creates a category by name.
    """
    if not name:
        return None
    category = Category.query.filter_by(name=name).first()
    if not category:
        category = Category(name=name, description=description)
        db.session.add(category)
        db.session.commit()
    return category

@views.route("/")
@login_required
def home():
    # Display home page to user
    return render_template("home.html", user=current_user)

@views.route("/workout", methods=["GET", "POST"])
@login_required
def workout():
    if request.method == "POST":
        request_type = request.form.get("request_type")
        if request_type == "save":
            workout_id = request.form.get("workout")
            weight_list = request.form.getlist("weight")
            details_list = request.form.getlist("details")
            workout = Workout.query.filter_by(id=workout_id).first()
            for i in range(len(workout.exercises)):
                if weight_list[i]:
                    weight = float(weight_list[i])
                    workout.exercises[i].weight = weight
                else:
                    workout.exercises[i].weight = None
                workout.exercises[i].details = details_list[i]
            db.session.commit()
        requested_workout = request.form.get("workout")
        return render_template(
            "workout.html",
            user=current_user,
            requested_workout=requested_workout,
            displayRequested="True",
        )
    return render_template("workout.html", user=current_user)

@views.route("/new-workout", methods=["GET", "POST"])
@login_required
def new_workout():
    from sqlalchemy.exc import SQLAlchemyError
    from . import seed_categories_if_empty

    # Ensure default categories if table is empty (for robustness in case before_first_request did not fire)
    seed_categories_if_empty()
    categories = Category.query.all()

    if not categories:
        # If categories is still empty, fallback to allow inline creation or inform user
        flash("No workout categories exist! Please create a category below or contact support.", category="error")

    if request.method == "POST":
        workout_name = request.form.get("workout_name")
        workout_description = request.form.get("workout_description")
        category_id = request.form.get("category_id")
        new_category_name = request.form.get("new_category_name")
        new_category_description = request.form.get("new_category_description")
        exercise_names = request.form.getlist("exercise_name")
        include_details = request.form.getlist("include_details")
        exercise_sets = request.form.getlist("exercise_sets")
        exercise_reps = request.form.getlist("exercise_reps")
        exercise_weights = request.form.getlist("exercise_weight")

        exercise_names = [exercise.upper() for exercise in exercise_names]

        # Determine the category to assign
        category = None
        if new_category_name:  # Handle creating a new category on the fly
            category = get_or_create_category(new_category_name, new_category_description)
            category_id = category.id
        elif category_id:
            category = Category.query.filter_by(id=category_id).first()
        else:
            category = None

        if not workout_name:
            flash("Must provide the workout name.", category="error")
        elif "" in exercise_names:
            flash("Must name all exercises.", category="error")
        elif not category:
            flash("Please choose or create a category.", category="error")
        else:
            try:
                new_workout = Workout(
                    user_id=current_user.id,
                    name=workout_name,
                    description=workout_description,
                    category_id=category.id if category else None,
                )
                db.session.add(new_workout)
                db.session.commit()

                for i in range(len(exercise_names)):
                    # Get tracking data if available
                    sets_value = None
                    reps_value = None
                    weight_value = None
                    
                    if i < len(exercise_sets) and exercise_sets[i]:
                        try:
                            sets_value = int(exercise_sets[i])
                        except (ValueError, TypeError):
                            sets_value = None
                    
                    if i < len(exercise_reps) and exercise_reps[i]:
                        reps_value = exercise_reps[i]
                    
                    if i < len(exercise_weights) and exercise_weights[i]:
                        try:
                            weight_value = float(exercise_weights[i])
                        except (ValueError, TypeError):
                            weight_value = None
                    
                    new_exercise = Exercise(
                        name=exercise_names[i],
                        include_details=int(include_details[i]),
                        workout_id=new_workout.id,
                        sets=sets_value,
                        reps=reps_value,
                        weight=weight_value,
                        details="",
                    )
                    db.session.add(new_exercise)
                db.session.commit()
                return redirect(url_for("views.home"))
            except SQLAlchemyError as e:
                db.session.rollback()
                flash("Database error: " + str(e), category="error")
    return render_template("new-workout.html", categories=categories)

@views.route("/edit-workout", methods=["GET", "POST"])
@login_required
def edit_workout():
    from sqlalchemy.exc import SQLAlchemyError
    from . import seed_categories_if_empty
    seed_categories_if_empty()
    categories = Category.query.all()  # For category dropdown
    if not categories:
        flash("No workout categories exist! Please create a new category below or contact support.", category="error")

    if request.method == "POST":
        request_type = request.form.get("request_type")
        if request_type == "save":
            workout_id = request.form.get("workout")
            workout_name = request.form.get("workout_name")
            workout_description = request.form.get("workout_description")
            category_id = request.form.get("category_id")
            new_category_name = request.form.get("new_category_name")
            new_category_description = request.form.get("new_category_description")
            exercise_names = request.form.getlist("exercise_name")
            include_details = request.form.getlist("include_details")
            weight_list = request.form.getlist("weight")
            details_list = request.form.getlist("details")
            exercise_sets = request.form.getlist("exercise_sets")
            exercise_reps = request.form.getlist("exercise_reps")
            exercise_weights = request.form.getlist("exercise_weight")
            exercise_names = [exercise.upper() for exercise in exercise_names]

            # Handle category assignment or creation
            category = None
            if new_category_name:
                category = get_or_create_category(new_category_name, new_category_description)
                category_id = category.id
            elif category_id:
                category = Category.query.filter_by(id=category_id).first()
            else:
                category = None

            if not workout_name:
                flash("Must provide the workout name.", category="error")
            elif "" in exercise_names:
                flash("Must name all exercises.", category="error")
            elif not category:
                flash("Please choose or create a category.", category="error")
            else:
                try:
                    workout = Workout.query.filter_by(id=workout_id).first()
                    for exercise in workout.exercises:
                        db.session.delete(exercise)
                    db.session.delete(workout)
                    db.session.commit()

                    new_workout = Workout(
                        id=workout_id,
                        user_id=current_user.id,
                        name=workout_name,
                        description=workout_description,
                        category_id=category.id if category else None
                    )
                    db.session.add(new_workout)
                    db.session.commit()

                    for i in range(len(exercise_names)):
                        # Get tracking data if available
                        sets_value = None
                        reps_value = None
                        weight_value = None
                        
                        if i < len(exercise_sets) and exercise_sets[i]:
                            try:
                                sets_value = int(exercise_sets[i])
                            except (ValueError, TypeError):
                                sets_value = None
                        
                        if i < len(exercise_reps) and exercise_reps[i]:
                            reps_value = exercise_reps[i]
                        
                        # Use new weight data if available, otherwise fall back to old weight_list
                        if i < len(exercise_weights) and exercise_weights[i]:
                            try:
                                weight_value = float(exercise_weights[i])
                            except (ValueError, TypeError):
                                weight_value = None
                        elif i < len(weight_list) and weight_list[i] and weight_list[i] != "None":
                            try:
                                weight_value = float(weight_list[i])
                            except (ValueError, TypeError):
                                weight_value = None
                        
                        new_exercise = Exercise(
                            name=exercise_names[i],
                            include_details=int(include_details[i]),
                            workout_id=new_workout.id,
                            sets=sets_value,
                            reps=reps_value,
                            weight=weight_value,
                            details=details_list[i] if i < len(details_list) else "",
                        )
                        db.session.add(new_exercise)
                    db.session.commit()
                    return redirect(url_for("views.home"))
                except SQLAlchemyError as e:
                    db.session.rollback()
                    flash("Database error: " + str(e), category="error")
        elif request_type == "cancel":
            return redirect(url_for("views.home"))
        elif request_type == "delete":
            workout_id = request.form.get("workout")
            workout = Workout.query.filter_by(id=workout_id).first()
            for exercise in workout.exercises:
                db.session.delete(exercise)
            db.session.delete(workout)
            db.session.commit()
            return redirect(url_for("views.home"))
        requested_workout = request.form.get("workout")
        return render_template(
            "edit-workout.html",
            user=current_user,
            requested_workout=requested_workout,
            displayRequested="True",
            categories=categories
        )
    return render_template("edit-workout.html", user=current_user, categories=categories)


# PUBLIC_INTERFACE
@views.route("/workout/<int:workout_id>/complete", methods=["POST"])
@login_required
def complete_workout(workout_id):
    """
    Mark a workout as completed for a user, record the session details and participant exercises.
    Expects JSON or form data with completed exercise details.
    ---
    post:
      summary: Mark a workout as complete and log results
      description: Records a completed workout session, including all exercise results, for tracking history and statistics.
      parameters:
      - in: path
        name: workout_id
        schema:
          type: integer
        required: true
        description: ID of the workout to record completion for
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            exercises:
              type: array
              description: Array of exercise records with their details performed in this session
              items:
                type: object
                properties:
                  exercise_id:
                    type: integer
                  weight:
                    type: number
                  reps:
                    type: integer
                  detail:
                    type: string
      responses:
        200:
          description: Workout session recorded successfully
        400:
          description: Invalid data provided
        404:
          description: Workout not found
        401:
          description: User not authorized
    tags:
      - Workout
    """
    # Validate workout and user context
    if not current_user.is_authenticated:
        flash("Not authorized.", "error")
        return redirect(url_for("auth.signin"))
    workout = Workout.query.filter_by(id=workout_id, user_id=current_user.id).first()
    if not workout:
        flash("Workout not found.", "error")
        return redirect(url_for("views.home"))

    # Accept data as JSON (API) or from a standard form POST
    if request.is_json:
        data = request.get_json()
    else:
        # Convert standard form data to expected dicts
        data = request.form.to_dict(flat=False)
        exercises = []
        if "exercise_id" in data:
            ex_ids = data.get("exercise_id")
            weights = data.get("weight", [])
            reps = data.get("reps", [])
            details = data.get("detail", [])
            for idx, ex_id in enumerate(ex_ids):
                exercises.append({
                    "exercise_id": int(ex_id),
                    "weight": float(weights[idx]) if idx < len(weights) and weights[idx] not in (None, "") else None,
                    "reps": int(reps[idx]) if idx < len(reps) and reps[idx] not in (None, "") else None,
                    "detail": details[idx] if idx < len(details) else None
                })
            data = { "exercises": exercises }
        elif "exercises" in data:
            data["exercises"] = data["exercises"]
        else:
            data = {}

    try:
        exercises_data = data.get("exercises", [])
        if not isinstance(exercises_data, list) or not exercises_data:
            flash("No exercise details provided.", "error")
            return redirect(url_for("views.workout", id=workout_id))

        # Create the workout session record
        workout_session = WorkoutSession(
            workout_id=workout_id,
            user_id=current_user.id,
            timestamp=db.func.now()
        )
        db.session.add(workout_session)
        db.session.flush()  # get workout_session.id

        # Log each exercise performed in this session
        for exercise in exercises_data:
            exercise_id = exercise.get("exercise_id")
            w = exercise.get("weight")
            r = exercise.get("reps")
            d = exercise.get("detail")

            # Ensure exercise belongs to this workout
            db_ex = Exercise.query.filter_by(id=exercise_id, workout_id=workout_id).first()
            if not db_ex:
                continue  # skip invalid

            ex_session = ExerciseSession(
                workout_session_id=workout_session.id,
                exercise_id=exercise_id,
                weight=w,
                reps=r,
                detail=d
            )
            db.session.add(ex_session)

        db.session.commit()
        flash("Workout session recorded! Great job!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Failed to log workout session: {str(e)}", "error")
        return redirect(url_for("views.workout", id=workout_id))

    return redirect(url_for("views.workout", id=workout_id))
