var add_exercise = document.getElementById("add_exercise");
var exercises = document.getElementById("exercises");
var checkboxes = document.getElementsByClassName("include_details");
var hidden_inputs = document.getElementsByClassName("include_details_hidden");
var exerciseCounter = document.getElementById("exercise-count");

/* Exercise counter management */
function updateExerciseCounter() {
    var count = exercises.querySelectorAll('.exercise-item').length;
    if (exerciseCounter) {
        exerciseCounter.textContent = count;
    }
    
    // Update exercise numbers
    var exerciseNumbers = exercises.querySelectorAll('.exercise-number');
    exerciseNumbers.forEach(function(numberEl, index) {
        numberEl.textContent = index + 1;
    });
}

/* Ensure category selection interacts smoothly in the form */
var categorySelectors = document.querySelectorAll('select[name="category_id"]');
categorySelectors.forEach(function(select) {
    select.addEventListener("focus", function() {
        select.size = select.options.length > 8 ? 8 : select.options.length;
    });
    select.addEventListener("blur", function() {
        select.size = 0;
    });
    select.addEventListener("change", function() {
        if (select.value) {
            document.getElementById('new_category_name').value = '';
            document.getElementById('new_category_description').value = '';
        }
    });
});

/* New category input handling */
var newCategoryName = document.getElementById('new_category_name');
var categorySelect = document.getElementById('category_id');
var newCategoryDescription = document.getElementById('new-category-description');

if (newCategoryName && categorySelect) {
    newCategoryName.addEventListener('input', function() {
        if (newCategoryName.value.trim().length > 0) {
            categorySelect.value = '';
            if (newCategoryDescription) {
                newCategoryDescription.style.display = 'block';
            }
        } else {
            if (newCategoryDescription) {
                newCategoryDescription.style.display = 'none';
            }
        }
    });
    
    categorySelect.addEventListener('change', function() {
        if (categorySelect.value) {
            newCategoryName.value = '';
            document.getElementById('new_category_description').value = '';
            if (newCategoryDescription) {
                newCategoryDescription.style.display = 'none';
            }
        }
    });
}

/* If duplication mode, prompt or highlight new defaults (optional UX) */
if (typeof window.duplicate_mode !== "undefined" && window.duplicate_mode) {
    document.body.classList.add('duplication-mode');
}

/* Handle first hidden input for include_details, if at least two checkboxes */
if (checkboxes.length > 1 && hidden_inputs.length > 1) {
    checkboxes[1].addEventListener("change", function() {
        hidden_inputs[1].disabled = checkboxes[1].checked;
    });
}

/* Enhanced delete functionality with animation */
function enableDeleteButtons(context) {
    (context || document).querySelectorAll(".exercise-remove-btn").forEach(function(element) {
        if (!element.hasListener) {
            element.addEventListener("click", function(e) {
                e.preventDefault();
                var exerciseItem = element.closest('.exercise-item');
                
                // Don't allow removing the last exercise
                var totalExercises = exercises.querySelectorAll('.exercise-item').length;
                if (totalExercises <= 1) {
                    return;
                }
                
                // Add removal animation
                exerciseItem.style.transform = 'translateX(-100%)';
                exerciseItem.style.opacity = '0';
                exerciseItem.style.transition = 'all 0.3s ease-out';
                
                setTimeout(function() {
                    exerciseItem.remove();
                    updateExerciseCounter();
                }, 300);
            });
            element.hasListener = true;
        }
    });
}
enableDeleteButtons(document);

/* Enhanced add exercise action */
add_exercise.addEventListener("click", function() {
    var template = document.getElementById("template").querySelector(".exercise-item");
    var clone = template.cloneNode(true);
    clone.hidden = false;
    
    // Enable all inputs in the cloned element
    var clone_inputs = clone.getElementsByTagName("input");
    var clone_buttons = clone.getElementsByTagName("button");
    
    for (let i = 0; i < clone_inputs.length; i++) {
        clone_inputs[i].disabled = false;
    }
    
    for (let i = 0; i < clone_buttons.length; i++) {
        clone_buttons[i].disabled = false;
    }
    
    // Add entry animation
    clone.style.transform = 'translateX(100%)';
    clone.style.opacity = '0';
    clone.style.transition = 'all 0.3s ease-out';
    
    enableDeleteButtons(clone);
    exercises.appendChild(clone);
    
    // Trigger animation
    setTimeout(function() {
        clone.style.transform = 'translateX(0)';
        clone.style.opacity = '1';
    }, 10);
    
    // Set up checkbox functionality
    var localCheckbox = clone.querySelector(".include_details");
    var localHidden = clone.querySelector(".include_details_hidden");
    if (localCheckbox && localHidden) {
        localCheckbox.addEventListener("change", function() {
            localHidden.disabled = localCheckbox.checked;
        });
    }
    
    // Focus on the new exercise name input
    var newInput = clone.querySelector('.exercise-name-input');
    if (newInput) {
        setTimeout(function() {
            newInput.focus();
        }, 350);
    }
    
    updateExerciseCounter();
});

/* Initialize counter on page load */
updateExerciseCounter();

/* Alert close functionality */
document.querySelectorAll('.alert-close').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var alert = btn.closest('.simple-alert');
        if (alert) {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(function() {
                alert.remove();
            }, 300);
        }
    });
});

/* Simple button feedback */
document.querySelectorAll('button, .btn-primary, .btn-secondary').forEach(function(btn) {
    btn.addEventListener('mousedown', function() {
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            btn.style.transform = 'scale(0.98)';
        }
    });
    
    btn.addEventListener('mouseup', function() {
        btn.style.transform = '';
    });
    
    btn.addEventListener('mouseleave', function() {
        btn.style.transform = '';
    });
});
