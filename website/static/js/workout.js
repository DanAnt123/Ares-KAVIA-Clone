var select_workout = document.getElementById("select_workout");

/* Show selected workout on page load */
if (select_workout) {
    var default_selected = document.getElementsByClassName(`workout ${select_workout.value}`)[0];
    if (default_selected) default_selected.hidden = false;

    /* Listen for change in select menu */
    select_workout.addEventListener("change", function() {
        /* Hide all workouts */
        var workouts = document.getElementsByClassName("workout");
        for (let i = 0; i < workouts.length; i++) {
            workouts[i].hidden = true;
        }
        /* Show selected workout */
        var selected = document.getElementsByClassName(`workout ${select_workout.value}`)[0];
        if (selected) selected.hidden = false;
    });

    /* Enhance workout selector for possible category UX extension */
    select_workout.addEventListener("focus", function() {
        select_workout.size = select_workout.options.length > 8 ? 8 : select_workout.options.length;
    });
    select_workout.addEventListener("blur", function() {
        select_workout.size = 0;
    });
}