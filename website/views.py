from . import db
from .models import Workout, Exercise, Category
from flask import Blueprint, render_template, request, flash, redirect, url_for
from flask_login import login_required, current_user

# Define blueprint
views = Blueprint('views', __name__)

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

    categories = Category.query.all()
    if request.method == "POST":
        workout_name = request.form.get("workout_name")
        workout_description = request.form.get("workout_description")
        category_id = request.form.get("category_id")
        new_category_name = request.form.get("new_category_name")
        new_category_description = request.form.get("new_category_description")
        exercise_names = request.form.getlist("exercise_name")
        include_details = request.form.getlist("include_details")

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
                    new_exercise = Exercise(
                        name=exercise_names[i],
                        include_details=int(include_details[i]),
                        workout_id=new_workout.id,
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
    categories = Category.query.all()  # For category dropdown
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
