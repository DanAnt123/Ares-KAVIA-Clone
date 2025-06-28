# Workout Page Architecture: Containers, Components, Interfaces, and Dependencies

## Overview

This document provides an architectural overview of the components, containers, interfaces, and dependencies that constitute the "workout page" in the Ares workout tracker web application. It is intended to assist developers in efficiently executing UI or functional updates by consolidating architectural knowledge relevant to the workout page and associated workflows.

## Architecture Diagram (Mermaid)

```mermaid
graph LR
    subgraph Flask Server
      VIEWS[views.py<br/>(Routes & Logic)]
      MODELS[models.py<br/>(ORM Models)]
      TEMPLATES["templates/workout.html<br/>templates/new-workout.html<br/>templates/edit-workout.html"]
      STATIC_JS["static/js/workout.js<br/>static/js/new-workout.js<br/>static/js/edit-workout.js"]
    end

    VIEWS -->|Renders| TEMPLATES
    VIEWS -->|DB Read/Write| MODELS
    VIEWS -->|JSON/Forms| TEMPLATES
    TEMPLATES -- DOM/Events --> STATIC_JS
```

## Main Containers & Components

### Backend (Flask)

- **views.py**
  - Defines all Flask routes and business logic for the workout experience:
    - `/workout`: Main workout page (GET displays, POST handles saves via AJAX or forms)
    - `/new-workout`: Displays workout creation form, processes new workouts (and exercises)
    - `/edit-workout`: Allows editing (renaming, reordering, deleting) of workouts and exercises
    - `/api/workout/history` and `/history`: Serve progress history
    - Implements supporting interfaces for workout/exercise completion, session logs, and handling AJAX
  - Acts as the logical container for all data flow and routing related to workouts

- **models.py**
  - Defines database models:
    - `User`: Owns many `Workout` and `WorkoutSession`
    - `Workout`: Contains fields and relationships for user, exercises, category
    - `Exercise`: Child of a workout with fields for name, weight, reps, details, etc.
    - `WorkoutSession`: Stores historical workout completions
    - `ExerciseLog`: Stores set-by-set, exercise-specific logs per session
    - `Category`: Optional category system for organizing workouts

### Frontend (Templates & Static Files)

- **Jinja2 Templates**
  - `templates/workout.html`: The core template for displaying and updating workouts
  - `templates/new-workout.html`: UI/form for creating new workouts and exercises
  - `templates/edit-workout.html`: UI/form for editing/deleting existing workouts
  - Templates pass necessary data (user, last session, workout IDs, etc.) to the frontend

- **JavaScript**
  - `static/js/workout.js`: Handles dynamic workout selection/switching, UX elements, modal/dialog accessibility, and form-related UI on the workout page
  - `static/js/new-workout.js`: Manages dynamic addition/removal of exercises in workout creation. Handles category selection, input validation, exercise count updating, and animated transitions for UI responsiveness.
  - `static/js/edit-workout.js`: Manages in-place editing and deletion of workout exercises in the edit screen. Provides dynamic validation and enhanced accessibility features.

- **CSS & Other Assets**
  - The templates reference various CSS files (not detailed here) for responsive/modern styling.

## Key Interfaces

- **Flask View Functions**
  - Provide endpoints for interacting with workout data, accepting both form-encoded and JSON (AJAX) requests
  - Public endpoints implement robust validation, user access control, and invoke data model changes as needed

- **Jinja2 Template Variables**
  - Data such as `user`, `last_session_data`, `requested_workout`, and `categories` is passed by Flask into templates for display and form logic

- **AJAX/JS JSON Endpoints**
  - For in-place updates (e.g., saving exercise or workout details as the user edits them), JavaScript sends or receives JSON to/from Flask endpoints, which reply with JSON responses for success/failure/UI updates

## Dependencies

- **Dependencies Between Components**
  - `views.py` depends on `models.py` for all ORM/database interactions
  - Templates receive their data context from Flask views and depend on consistent structure of variables (such as lists of workouts, exercises, etc.)
  - JavaScript code expects certain DOM structure and variable names present in templates (e.g., IDs, classes for exercise items)

- **3rd-Party Packages and Libraries**
  - Backend: Flask, Flask-Login, SQLAlchemy, Flask-Migrate
  - Frontend: Vanilla JavaScript; icons via FontAwesome; (external sortable/animation libraries may be referenced)

## Data and Control Flow

1. **Page Load**
   - Flask renders the relevant template (`workout.html`, `new-workout.html`, etc.), passing current user and relevant workout/exercise data.
   - Initial page view is determined by the route and Flask view logic.

2. **User Interaction**
   - JS listens for form submissions, button clicks (add/remove exercise), category switches, and triggers DOM/UI changes.
   - AJAX calls or standard form submissions update data; if AJAX, only relevant UI is updated, otherwise a full page reload.

3. **Data Update**
   - On form/AJAX submission, views.py validates and (if passes) updates database via models.py
   - Depending on result, frontend receives updated view or error messages.

4. **Persistence**
   - All workout and exercise data is persisted to the PostgreSQL database via SQLAlchemy ORM.

## Summary

This architecture is designed to keep the Flask backend responsible for business logic, form validation, and data persistence, while HTML templates and JavaScript manage dynamic UI and user interaction. There is a tight coupling between Flask view-provided context, DOM structure in Jinja2 templates, and JavaScript event handling to enable a responsive and fluid workout tracking workflow.

## References

- `/website/views.py`
- `/website/models.py`
- `/website/templates/workout.html`, `/website/templates/new-workout.html`, `/website/templates/edit-workout.html`
- `/website/static/js/workout.js`, `/website/static/js/new-workout.js`, `/website/static/js/edit-workout.js`
