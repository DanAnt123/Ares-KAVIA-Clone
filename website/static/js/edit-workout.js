var select_workout = document.getElementById("select_workout");

// PUBLIC_INTERFACE
/**
 * Show the selected workout form and hide others.
 * @param {string} workoutId - The ID of the workout to show
 */
function showSelectedWorkout(workoutId) {
    /* Hide all workout containers */
    var workoutContainers = document.getElementsByClassName("workout-edit-container");
    for (let i = 0; i < workoutContainers.length; i++) {
        workoutContainers[i].hidden = true;
    }

    /* Show selected workout container */
    var selected = document.getElementsByClassName(`workout-${workoutId}`)[0];
    if (selected) {
        selected.hidden = false;
    }
}

/* Show selected workout on page load */
if (select_workout && select_workout.value) {
    showSelectedWorkout(select_workout.value);
}

/* Listen for change in select menu */
if (select_workout) {
    select_workout.addEventListener("change", function() {
        showSelectedWorkout(this.value);
    });
}

/* Attach submit event listener to all workout edit forms (for validation) */
document.querySelectorAll('.workout-edit-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
        var name = form.querySelector('input[name="workout_name"]');
        var description = form.querySelector('input[name="workout_description"]');
        if (name && (name.value.length < 1 || name.value.length > 50)) {
            alert("Workout name must be 1-50 characters long.");
            name.focus();
            e.preventDefault();
            return false;
        }
        if (description && description.value.length > 50) {
            alert("Description can be up to 50 characters long.");
            description.focus();
            e.preventDefault();
            return false;
        }
        return true;
    });
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
        select.size = select.options.length > 8 ? 8 : select.options.length;
    });
    select.addEventListener("blur", function() {
        select.size = 0;
    });
});

/* Handle duplication button if AJAX/modal support is desired -- fallback to form submit */
document.querySelectorAll('form[action*="duplicate_workout"], button[title="Duplicate this workout"]').forEach(function(btnOrForm) {
    if (btnOrForm.tagName === 'FORM') {
        return;
    }
    btnOrForm.addEventListener("click", function(e) {
        // Optionally show custom duplication modal/confirmation.
    });
});

/* === Modal accessibility enhancement === */

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
                // Backward tab
                if (document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                }
            } else {
                // Forward tab
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

    // On close, remove event
    modalContainer.__trapHandler = handleFocusTrap;
}
function untrapFocus(modalContainer) {
    if (modalContainer.__trapHandler) {
        modalContainer.removeEventListener('keydown', modalContainer.__trapHandler);
        delete modalContainer.__trapHandler;
    }
}
function openModal(modalContainer) {
    modalContainer.classList.add('show');
    modalContainer.setAttribute("aria-modal", "true");
    modalContainer.setAttribute("role", "dialog");
    let modal = modalContainer.querySelector('.modal');
    if (modal) {
        modal.setAttribute("role", "document");
        modal.setAttribute("tabindex", "-1");
        modal.focus();
    }
    // Trap focus
    setTimeout(() => {
        let focusableEls = modalContainer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableEls.length) {
            focusableEls[0].focus();
        } else if (modal) {
            modal.focus();
        }
    }, 10);
    trapFocus(modalContainer);
    document.body.setAttribute("aria-hidden", "true");
}
function closeModal(modalContainer) {
    // Animate modal out (handled by CSS transitions)
    modalContainer.classList.remove('show');
    modalContainer.removeAttribute("aria-modal");
    modalContainer.removeAttribute("role");
    untrapFocus(modalContainer);
    document.body.removeAttribute("aria-hidden");
    if (modalContainer.__opener) {
        modalContainer.__opener.focus();
    }
}

document.querySelectorAll('[class^="modal-open"]').forEach(function(openBtn) {
    const classes = openBtn.className.split(/\s+/);
    for (let i = 0; i < classes.length; i++) {
        let modalSelector = `.modal-container.${classes[i]}`;
        let modalContainer = document.querySelector(modalSelector);
        if (modalContainer) {
            openBtn.addEventListener('click', function(e) {
                e.preventDefault();
                modalContainer.__opener = openBtn;
                openModal(modalContainer);
            });
            const closeBtn = modalContainer.querySelector('.modal-close');
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
        }
    }
});

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
// Auto-fade info/success alerts after 4s
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
