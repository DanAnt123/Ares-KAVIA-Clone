var select_workout = document.getElementById("select_workout");

/* Show selected workout on page load */
var selected_workout = document.getElementsByClassName(`workout ${select_workout.value}`)[0];
if (selected_workout) {
    selected_workout.hidden = false;
}

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

/* Listen for delete exercise buttons (applies to addable/removable exercises) */
function enableDeleteButtons(context) {
    (context || document).querySelectorAll(".delete").forEach(function(element) {
        if (!element.hasListener) {
            element.addEventListener("click", function() {
                element.parentElement.parentElement.remove();
            });
            element.hasListener = true;
        }
    });
}
enableDeleteButtons(document);

/* Enable category dropdown enhanced UX (focus border, scroll-to-selected, etc.) */
document.querySelectorAll('select[name="category_id"]').forEach(function(select) {
    select.addEventListener("focus", function() {
        // Optionally, could highlight or scroll to selected option.
        // For now, just ensure the dropdown opens.
        select.size = select.options.length > 8 ? 8 : select.options.length;
    });
    select.addEventListener("blur", function() {
        select.size = 0;
    });
});

/* Handle duplication button if AJAX/modal support is desired -- fallback to form submit */
document.querySelectorAll('form[action*="duplicate_workout"], button[title="Duplicate this workout"]').forEach(function(btnOrForm) {
    if (btnOrForm.tagName === 'FORM') {
        // If it's a form, nothing overrides default (submits GET and reloads)
        return;
    }
    btnOrForm.addEventListener("click", function(e) {
        // If you'd like to show a custom duplication modal/confirmation, this is the place.
        // Here we let default submit go.
    });
});