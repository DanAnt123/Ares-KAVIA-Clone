var add_exercise = document.getElementById("add_exercise");
var exercises = document.getElementById("exercises");
var checkboxes = document.getElementsByClassName("include_details");
var hidden_inputs = document.getElementsByClassName("include_details_hidden");
var exerciseCounter = document.getElementById("exercise-count");

/* Exercise counter management */
function updateExerciseCounter() {
    var count = exercises.querySelectorAll('.exercise-edit').length;
    if (exerciseCounter) {
        exerciseCounter.textContent = count;
    }
    
    // Update exercise numbers
    var exerciseNumbers = exercises.querySelectorAll('.exercise-index');
    exerciseNumbers.forEach(function(numberEl, index) {
        numberEl.textContent = index + 1;
    });
    
    // Update stepper progress
    updateStepperProgress();
}

/* Stepper progress management */
function updateStepperProgress() {
    var steps = document.querySelectorAll('.step');
    var hasName = document.getElementById('workout_name').value.trim().length > 0;
    var hasCategory = document.getElementById('category_id').value || document.getElementById('new_category_name').value.trim().length > 0;
    var hasExercises = exercises.querySelectorAll('.exercise-edit').length > 0;
    
    // Step 1: Basic Info
    if (hasName && hasCategory) {
        steps[0].classList.add('step-completed');
        steps[1].classList.add('step-active');
        steps[0].classList.remove('step-active');
    } else {
        steps[0].classList.add('step-active');
        steps[1].classList.remove('step-active', 'step-completed');
    }
    
    // Step 2: Exercises
    if (hasExercises && hasName && hasCategory) {
        steps[1].classList.add('step-completed');
        steps[2].classList.add('step-active');
        steps[1].classList.remove('step-active');
    }
}

/* Enhanced form validation and progress tracking */
document.addEventListener('input', function(e) {
    if (e.target.matches('#workout_name, #category_id, #new_category_name')) {
        updateStepperProgress();
    }
});

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

if (newCategoryName && categorySelect) {
    newCategoryName.addEventListener('input', function() {
        if (newCategoryName.value.trim().length > 0) {
            categorySelect.value = '';
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
    (context || document).querySelectorAll(".delete").forEach(function(element) {
        if (!element.hasListener) {
            element.addEventListener("click", function(e) {
                e.preventDefault();
                var exerciseItem = element.closest('.exercise-edit');
                
                // Add removal animation
                exerciseItem.style.transform = 'translateX(-100%)';
                exerciseItem.style.opacity = '0';
                
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
    var template = document.getElementById("template").querySelector(".exercise-edit");
    var clone = template.cloneNode(true);
    clone.hidden = false;
    
    // Enable all inputs in the cloned element
    var clone_inputs = clone.getElementsByTagName("input");
    for (let i = 0; i < clone_inputs.length; i++) {
        clone_inputs[i].disabled = false;
    }
    
    // Add entry animation
    clone.style.transform = 'translateX(100%)';
    clone.style.opacity = '0';
    
    enableDeleteButtons(clone);
    exercises.appendChild(clone);
    
    // Trigger animation
    setTimeout(function() {
        clone.style.transform = 'translateX(0)';
        clone.style.opacity = '1';
        clone.style.transition = 'all 0.3s ease-out';
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
    var newInput = clone.querySelector('.exercise-edit-name');
    if (newInput) {
        setTimeout(function() {
            newInput.focus();
        }, 350);
    }
    
    updateExerciseCounter();
});

/* Exercise template buttons */
document.querySelectorAll('.template-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        var exercisesData = btn.getAttribute('data-exercises');
        if (exercisesData) {
            var exerciseNames = exercisesData.split(',');
            
            // Clear existing exercises first
            var existingExercises = exercises.querySelectorAll('.exercise-edit');
            existingExercises.forEach(function(exercise) {
                exercise.remove();
            });
            
            // Add new exercises from template
            exerciseNames.forEach(function(name, index) {
                if (index === 0) {
                    // Update the first exercise
                    var firstInput = exercises.querySelector('.exercise-edit-name');
                    if (firstInput) {
                        firstInput.value = name.trim();
                    }
                } else {
                    // Add additional exercises
                    setTimeout(function() {
                        add_exercise.click();
                        setTimeout(function() {
                            var lastInput = exercises.querySelector('.exercise-edit:last-child .exercise-edit-name');
                            if (lastInput) {
                                lastInput.value = name.trim();
                            }
                        }, 100);
                    }, index * 200);
                }
            });
            
            // Add visual feedback
            btn.style.transform = 'scale(0.95)';
            setTimeout(function() {
                btn.style.transform = '';
            }, 150);
        }
    });
});

/* Enhanced preview functionality */
var previewBtn = document.querySelector('.creation-preview-btn');
if (previewBtn) {
    previewBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Collect form data
        var workoutName = document.getElementById('workout_name').value.trim();
        var workoutDesc = document.getElementById('workout_description').value.trim();
        var categoryId = document.getElementById('category_id').value;
        var newCategoryName = document.getElementById('new_category_name').value.trim();
        
        var exerciseList = [];
        exercises.querySelectorAll('.exercise-edit').forEach(function(exercise) {
            var name = exercise.querySelector('.exercise-edit-name').value.trim();
            var includeDetails = exercise.querySelector('.include_details').checked;
            if (name) {
                exerciseList.push({
                    name: name,
                    includeDetails: includeDetails
                });
            }
        });
        
        // Show preview modal or summary
        showPreviewSummary({
            name: workoutName,
            description: workoutDesc,
            categoryId: categoryId,
            newCategoryName: newCategoryName,
            exercises: exerciseList
        });
    });
}

function showPreviewSummary(data) {
    var summary = 'Workout Preview:\n\n';
    summary += 'Name: ' + (data.name || 'Not specified') + '\n';
    if (data.description) summary += 'Description: ' + data.description + '\n';
    summary += 'Category: ' + (data.newCategoryName || 'Selected from dropdown') + '\n\n';
    summary += 'Exercises (' + data.exercises.length + '):\n';
    
    data.exercises.forEach(function(exercise, index) {
        summary += (index + 1) + '. ' + exercise.name;
        if (exercise.includeDetails) summary += ' (with tracking)';
        summary += '\n';
    });
    
    alert(summary);
}

/* Initialize counter on page load */
updateExerciseCounter();

/* Create sortable list */
if (typeof Sortable !== "undefined") {
    new Sortable(exercises, {
        animation: 250,
        handle: ".handle",
    });
}

/* ==== MODAL ACCESSIBILITY SUPPORT ==== */
document.querySelectorAll('[class^="modal-open"]').forEach(function(openBtn) {
    const classes = openBtn.className.split(/\s+/);
    for (let i = 0; i < classes.length; i++) {
        let modalSelector = `.modal-container.${classes[i]}`;
        let modalContainer = document.querySelector(modalSelector);
        if (modalContainer) {
            modalContainer.setAttribute("role", "dialog");
            modalContainer.setAttribute("aria-modal", "true");
            modalContainer.setAttribute("tabindex", "-1");
            let modalTitle = modalContainer.querySelector('.modal-title');
            if (modalTitle && modalTitle.id) {
                modalContainer.setAttribute('aria-labelledby', modalTitle.id);
            } else if (modalTitle) {
                modalTitle.id = "modal-title-" + Math.random().toString(36).substr(2, 8);
                modalContainer.setAttribute('aria-labelledby', modalTitle.id);
            }
            openBtn.addEventListener('click', function(e) {
                e.preventDefault();
                modalContainer.classList.add('show');
                modalContainer.__opener = openBtn;
                setTimeout(() => {
                    let focEl = modalContainer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if (focEl) focEl.focus();
                    else modalContainer.focus();
                }, 10);
                document.body.setAttribute("aria-hidden", "true");
                trapFocus(modalContainer);
            });
            let closeBtn = modalContainer.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    closeModal(modalContainer);
                });
            }
            modalContainer.addEventListener('mousedown', function(e) {
                if (e.target === modalContainer) {
                    closeModal(modalContainer);
                }
            });
        }
    }
});
function trapFocus(modalContainer) {
    const focusableSelectors = [
        'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
        'textarea:not([disabled])', 'button:not([disabled])', 'iframe', 'object', 'embed',
        '[tabindex]:not([tabindex="-1"])', '[contenteditable]'
    ];
    const focusableElements = modalContainer.querySelectorAll(focusableSelectors.join(', '));
    if (focusableElements.length === 0) return;
    let firstEl = focusableElements[0];
    let lastEl = focusableElements[focusableElements.length - 1];
    function handleFocusTrap(e) {
        if (e.key === 'Tab' || e.keyCode === 9) {
            if (e.shiftKey) {
                if (document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                }
            } else {
                if (document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        } else if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
            closeModal(modalContainer);
        }
    }
    modalContainer.addEventListener('keydown', handleFocusTrap);
    modalContainer.__trapHandler = handleFocusTrap;
}
function untrapFocus(modalContainer) {
    if (modalContainer.__trapHandler) {
        modalContainer.removeEventListener('keydown', modalContainer.__trapHandler);
        delete modalContainer.__trapHandler;
    }
}
function closeModal(modalContainer) {
    modalContainer.classList.remove('show');
    modalContainer.removeAttribute("aria-modal");
    modalContainer.removeAttribute("role");
    untrapFocus(modalContainer);
    document.body.removeAttribute("aria-hidden");
    if (modalContainer.__opener) {
        modalContainer.__opener.focus();
    }
}

/* ==== Accessible animations and transitions (UI feedback) ==== */
/* --- Alert Fade/Slide --- */
function animateAlertDisappearance(alertEl) {
    if (!alertEl) return;
    alertEl.classList.add('alert-hide');
    setTimeout(() => {
        alertEl.classList.remove('show', 'alert-hide');
        alertEl.style.display = 'none';
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 320);
}
document.querySelectorAll('.alert .alert-close').forEach(btn => {
    btn.addEventListener('click', function () {
        const alertEl = btn.closest('.alert');
        animateAlertDisappearance(alertEl);
    });
});
document.querySelectorAll('.alert.show:not(.alert-error)').forEach(alertEl => {
    setTimeout(() => animateAlertDisappearance(alertEl), 4100);
});

/* --- Button interaction --- */
document.querySelectorAll('button, .btn, .btn-edit').forEach(btn => {
    btn.addEventListener('pointerdown', function () {
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            btn.style.transform = 'scale(0.97)';
        }
    });
    btn.addEventListener('pointerup', function () {
        btn.style.transform = '';
    });
    btn.addEventListener('pointerleave', function () {
        btn.style.transform = '';
    });
});

/* --- Form Error Shake (apply .form-error-animate on error node) --- */
function triggerFormErrorAnimation(el) {
    if (!el) return;
    el.classList.remove('form-error-animate');
    void el.offsetWidth;
    el.classList.add('form-error-animate');
    setTimeout(() => {
        el.classList.remove('form-error-animate');
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 520);
}
// Example: triggerFormErrorAnimation(document.querySelector(".alert-error"));
