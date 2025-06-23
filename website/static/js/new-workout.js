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
    var template = document.getElementById("template").querySelector(".exercise-edit");
    var clone = template.cloneNode(true);
    clone.hidden = false;
    var clone_inputs = clone.getElementsByTagName("input");
    for (let i = 0; i < clone_inputs.length; i++) {
        clone_inputs[i].disabled = false;
    }
    enableDeleteButtons(clone);
    exercises.appendChild(clone);
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

/* ==== MODAL ACCESSIBILITY SUPPORT: For any dynamic containers, e.g. custom modals support ==== */
/* If 'modal-open' buttons and modals are present, activate full ARIA/focus trapping */

document.querySelectorAll('[class^="modal-open"]').forEach(function(openBtn) {
    // Button that opens modal: e.g., Delete workout (if new modal present in other future templates)
    const classes = openBtn.className.split(/\s+/);
    for (let i = 0; i < classes.length; i++) {
        let modalSelector = `.modal-container.${classes[i]}`;
        let modalContainer = document.querySelector(modalSelector);
        if (modalContainer) {
            // Modal ARIA roles/attributes
            modalContainer.setAttribute("role", "dialog");
            modalContainer.setAttribute("aria-modal", "true");
            modalContainer.setAttribute("tabindex", "-1");
            // If modal has title, ensure aria-labelledby
            let modalTitle = modalContainer.querySelector('.modal-title');
            if (modalTitle && modalTitle.id) {
                modalContainer.setAttribute('aria-labelledby', modalTitle.id);
            } else if (modalTitle) {
                modalTitle.id = "modal-title-" + Math.random().toString(36).substr(2, 8);
                modalContainer.setAttribute('aria-labelledby', modalTitle.id);
            }
            // Open handler
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
            // Close handlers
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

/* Trap keyboard focus in modal and ESC support */
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