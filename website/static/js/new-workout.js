var add_exercise = document.getElementById("add_exercise");
var exercises = document.getElementById("exercises");
var checkboxes = document.getElementsByClassName("include_details");
var hidden_inputs = document.getElementsByClassName("include_details_hidden");

/* Ensure category selection interacts smoothly in the form */
var categorySelectors = document.querySelectorAll('select[name="category_id"]');
categorySelectors.forEach(function(select) {
    select.addEventListener("focus", function() {
        select.size = select.options.length > 8 ? 8 : select.options.length;
    });
    select.addEventListener("blur", function() {
        select.size = 0;
    });
});

/* If duplication mode, prompt or highlight new defaults (optional UX) */
if (typeof window.duplicate_mode !== "undefined" && window.duplicate_mode) {
    // Optionally highlight or show note to the user
    // Example: add a CSS class to the form for duplicated styling, or prompt
    document.body.classList.add('duplication-mode');
}

/* Handle first hidden input for include_details, if at least two checkboxes */
if (checkboxes.length > 1 && hidden_inputs.length > 1) {
    checkboxes[1].addEventListener("change", function() {
        hidden_inputs[1].disabled = checkboxes[1].checked;
    });
}

/* Listen for delete exercise buttons */
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

/* Add exercise action */
add_exercise.addEventListener("click", function() {
    /* Clone template */
    var template = document.getElementById("template").querySelector(".exercise-edit");
    var clone = template.cloneNode(true);

    /* Show and enable inputs */
    clone.hidden = false;
    var clone_inputs = clone.getElementsByTagName("input");
    for (let i = 0; i < clone_inputs.length; i++) {
        clone_inputs[i].disabled = false;
    }

    /* Add listener for delete exercise button */
    enableDeleteButtons(clone);

    /* Add to workout form */
    exercises.appendChild(clone);

    /* Handle hidden input for include_details */
    var localCheckbox = clone.querySelector(".include_details");
    var localHidden = clone.querySelector(".include_details_hidden");
    if (localCheckbox && localHidden) {
        localCheckbox.addEventListener("change", function() {
            localHidden.disabled = localCheckbox.checked;
        });
    }
});

/* Create sortable list */
if (typeof Sortable !== "undefined") {
    new Sortable(exercises, {
        animation: 250,
        handle: ".handle",
    });
}