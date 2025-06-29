# PUBLIC_INTERFACE
@views.route("/api/progress/performance-summary", methods=["GET"])
@login_required
def get_performance_summary():
    """
    Get overall performance summary including key metrics across all workouts.
    Provides aggregate statistics suitable for dashboard display.
    Fixed to handle duplicate sessions and provide accurate metrics.

    Returns:
        JSON response with performance summary metrics
    """
    try:
        # Get date range filter from query parameters
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all sessions within the date range, ordered by timestamp
        all_sessions = (WorkoutSession.query
                       .filter_by(user_id=current_user.id)
                       .filter(WorkoutSession.timestamp >= start_date)
                       .order_by(WorkoutSession.timestamp.desc())
                       .all())
        
        if not all_sessions:
            return jsonify({
                "period_days": days,
                "total_sessions": 0,
                "total_exercises": 0,
                "total_volume": 0,
                "averages": {
                    "exercises_per_session": 0,
                    "volume_per_session": 0,
                    "sessions_per_week": 0
                },
                "top_exercises": [],
                "top_workouts": [],
                "unique_exercises": 0,
                "unique_workouts": 0,
                "message": "No workout sessions found in the specified period"
            })
        
        # Remove duplicate sessions that are within 5 minutes of each other for the same workout
        unique_sessions = []
        session_threshold = timedelta(minutes=5)
        
        for session in all_sessions:
            is_duplicate = False
            for existing_session in unique_sessions:
                if (session.workout_id == existing_session.workout_id and 
                    abs((session.timestamp - existing_session.timestamp).total_seconds()) < session_threshold.total_seconds()):
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_sessions.append(session)
        
        sessions = unique_sessions
        total_sessions = len(sessions)
        
        # Calculate summary metrics with proper deduplication
        total_exercise_sets = 0  # Total number of exercise sets performed
        total_unique_exercises_performed = 0  # Total unique exercises performed across all sessions
        total_volume = 0
        exercise_frequency = defaultdict(int)  # Count of times each exercise was performed (sessions, not sets)
        workout_frequency = defaultdict(int)
        unique_exercises_per_session = []
        
        for session in sessions:
            # Track workout frequency (count unique sessions per workout)
            if session.workout and session.workout.name:
                workout_frequency[session.workout.name] += 1
            
            # Track exercises performed in this session
            session_exercises = set()
            session_volume = 0
            
            for log in session.exercise_logs:
                # Count total sets
                total_exercise_sets += 1
                
                # Track unique exercises in this session
                session_exercises.add(log.exercise_name)
                
                # Calculate volume for this set
                if log.weight and log.reps:
                    set_volume = log.weight * log.reps
                    total_volume += set_volume
                    session_volume += set_volume
            
            # Track exercise frequency (count sessions where exercise was performed, not individual sets)
            for exercise_name in session_exercises:
                exercise_frequency[exercise_name] += 1
            
            # Track unique exercises performed in this session
            unique_exercises_per_session.append(len(session_exercises))
            total_unique_exercises_performed += len(session_exercises)
        
        # Find most frequent exercises and workouts
        top_exercises = sorted(exercise_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        top_workouts = sorted(workout_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Calculate proper averages
        avg_exercises_per_session = round(total_unique_exercises_performed / total_sessions, 1) if total_sessions > 0 else 0
        avg_volume_per_session = round(total_volume / total_sessions, 2) if total_sessions > 0 else 0
        
        # Calculate weekly frequency more accurately
        if days >= 7:
            weeks_in_period = days / 7.0
            sessions_per_week = round(total_sessions / weeks_in_period, 1)
        else:
            # For periods less than a week, extrapolate based on daily average
            daily_average = total_sessions / days if days > 0 else 0
            sessions_per_week = round(daily_average * 7, 1)
        
        # Calculate additional useful metrics
        avg_sets_per_session = round(total_exercise_sets / total_sessions, 1) if total_sessions > 0 else 0
        avg_volume_per_set = round(total_volume / total_exercise_sets, 2) if total_exercise_sets > 0 else 0
        
        return jsonify({
            "period_days": days,
            "start_date": start_date.date().isoformat(),
            "end_date": datetime.utcnow().date().isoformat(),
            "total_sessions": total_sessions,
            "total_exercises": total_unique_exercises_performed,
            "total_sets": total_exercise_sets,
            "total_volume": round(total_volume, 2),
            "averages": {
                "exercises_per_session": avg_exercises_per_session,
                "sets_per_session": avg_sets_per_session,
                "volume_per_session": avg_volume_per_session,
                "volume_per_set": avg_volume_per_set,
                "sessions_per_week": sessions_per_week
            },
            "top_exercises": [{"name": name, "frequency": freq} for name, freq in top_exercises],
            "top_workouts": [{"name": name, "frequency": freq} for name, freq in top_workouts],
            "unique_exercises": len(exercise_frequency),
            "unique_workouts": len(workout_frequency),
            "data_quality": {
                "raw_sessions_found": len(all_sessions),
                "duplicate_sessions_filtered": len(all_sessions) - len(sessions),
                "deduplication_threshold_minutes": 5
            }
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Failed to retrieve performance summary: {str(e)}"
        }), 500
