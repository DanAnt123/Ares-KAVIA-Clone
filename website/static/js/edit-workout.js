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

/**
 * Trap focus within modal when open (accessibility requirement)
 * @param {HTMLElement} modalContainer
 */
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
            // Close with ESC
            closeModal(modalContainer);
        }
    }

    modalContainer.addEventListener('keydown', handleFocusTrap);

    // On close, remove event
    modalContainer.__trapHandler = handleFocusTrap;
}

/**
 * Remove trapFocus handlers and ARIA on modal container.
 * @param {HTMLElement} modalContainer
 */
function untrapFocus(modalContainer) {
    if (modalContainer.__trapHandler) {
        modalContainer.removeEventListener('keydown', modalContainer.__trapHandler);
        delete modalContainer.__trapHandler;
    }
}

/**
 * Show modal with ARIA and focus management.
 * @param {HTMLElement} modalContainer
 */
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

/**
 * Hide modal and restore main document accessibility.
 * @param {HTMLElement} modalContainer
 */
function closeModal(modalContainer) {
    modalContainer.classList.remove('show');
    modalContainer.removeAttribute("aria-modal");
    modalContainer.removeAttribute("role");
    untrapFocus(modalContainer);
    document.body.removeAttribute("aria-hidden");
    // Optionally, restore focus to the button that opened the modal
    if (modalContainer.__opener) {
        modalContainer.__opener.focus();
    }
}

document.querySelectorAll('[class^="modal-open"]').forEach(function(openBtn) {
    // Button that opens modal: e.g., Delete workout
    const classes = openBtn.className.split(/\s+/);
    for (let i = 0; i < classes.length; i++) {
        // Each modal-container shares a class for the relevant workout
        let modalSelector = `.modal-container.${classes[i]}`;
        let modalContainer = document.querySelector(modalSelector);
        if (modalContainer) {
            openBtn.addEventListener('click', function(e) {
                e.preventDefault();
                modalContainer.__opener = openBtn;
                openModal(modalContainer);
            });
            // Find and wire up close buttons inside modal
            const closeBtn = modalContainer.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    closeModal(modalContainer);
                });
            }
            // Also close when clicking the overlay (outside the actual modal box)
            modalContainer.addEventListener('mousedown', function(e) {
                if (e.target === modalContainer) {
                    closeModal(modalContainer);
                }
            });
            // Ensure ARIA role for the modal and dynamic ARIA attributes
            modalContainer.setAttribute("role", "dialog");
            modalContainer.setAttribute("aria-modal", "true");
            modalContainer.setAttribute("tabindex", "-1");
            // Set ARIA-labelledby if a title is present
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