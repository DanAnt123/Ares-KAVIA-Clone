var add_exercise = document.getElementById("add_exercise");
var exercises = document.getElementById("exercises");
var checkboxes = document.getElementsByClassName("include_details");
var hidden_inputs = document.getElementsByClassName("include_details_hidden");
var exerciseCounter = document.getElementById("exercise-count");

/* Validate workout name and description length on form submission */
document.getElementById('workout').addEventListener('submit', function (e) {
    var nameInput = document.getElementById('workout_name');
    var descriptionInput = document.getElementById('workout_description');
    var name = nameInput.value.trim();
    var description = descriptionInput.value.trim();
    if (name.length < 1 || name.length > 50) {
        alert("Workout name must be 1-50 characters long.");
        nameInput.focus();
        e.preventDefault();
        return false;
    }
    if (description.length > 50) {
        alert("Description can be up to 50 characters long.");
        descriptionInput.focus();
        e.preventDefault();
        return false;
    }
    return true;
});

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

/* Enhanced category selection with custom dropdown support */
var categorySelect = document.getElementById('category_id');
var categoryDropdown = null;

// Initialize custom dropdown when available
function initializeCategoryDropdownInteraction() {
    // Wait for custom dropdown to be initialized
    setTimeout(function() {
        categoryDropdown = window.customDropdowns ? window.customDropdowns.get(categorySelect) : null;
        
        if (categoryDropdown) {
            console.log('Custom dropdown integration ready');
            // Custom dropdown handles its own interactions
        } else {
            // Fallback to native select behavior
            console.log('Using native select fallback');
            if (categorySelect) {
                categorySelect.addEventListener("focus", function() {
                    categorySelect.size = categorySelect.options.length > 8 ? 8 : categorySelect.options.length;
                });
                categorySelect.addEventListener("blur", function() {
                    categorySelect.size = 0;
                });
            }
        }
        
        // Listen for changes regardless of dropdown type
        if (categorySelect) {
            categorySelect.addEventListener("change", function() {
                if (categorySelect.value) {
                    document.getElementById('new_category_name').value = '';
                    document.getElementById('new_category_description').value = '';
                }
            });
        }
    }, 100);
}

// Initialize category dropdown interaction
initializeCategoryDropdownInteraction();

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

/* Handle tracking details visibility for all exercises */
function setupTrackingToggle(exerciseContainer) {
    var checkbox = exerciseContainer.querySelector('.include_details');
    var hiddenInput = exerciseContainer.querySelector('.include_details_hidden');
    var trackingDetails = exerciseContainer.querySelector('.exercise-tracking-details');
    var trackingInputs = exerciseContainer.querySelectorAll('.tracking-input');
    
    if (checkbox && hiddenInput && trackingDetails) {
        checkbox.addEventListener('change', function() {
            hiddenInput.disabled = checkbox.checked;
            
            if (checkbox.checked) {
                trackingDetails.style.display = 'block';
                trackingInputs.forEach(function(input) {
                    input.disabled = false;
                });
            } else {
                trackingDetails.style.display = 'none';
                trackingInputs.forEach(function(input) {
                    input.disabled = true;
                    input.value = '';
                });
            }
        });
    }
}

/* Initialize tracking toggle for existing exercises */
document.querySelectorAll('.exercise-item').forEach(function(exerciseItem) {
    setupTrackingToggle(exerciseItem);
});

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
    
    // Set up checkbox and tracking functionality
    setupTrackingToggle(clone);
    
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
