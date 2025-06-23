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

/* === (Potential future modals/dynamic overlays: focus/ARIA/ESC support) === */
document.querySelectorAll('.modal-container').forEach(function(container) {
    // Add ARIA/keyboard support for any present/future modals here
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");
    container.setAttribute("tabindex", "-1");
    let modalTitle = container.querySelector('.modal-title');
    if (modalTitle && modalTitle.id) {
        container.setAttribute('aria-labelledby', modalTitle.id);
    } else if (modalTitle) {
        modalTitle.id = "modal-title-" + Math.random().toString(36).substr(2, 8);
        container.setAttribute('aria-labelledby', modalTitle.id);
    }
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
    let openBtn = document.querySelector('[class~="modal-open"]');
    if (openBtn) {
        openBtn.addEventListener('click', function(e) {
            e.preventDefault();
            container.classList.add('show');
            container.__opener = openBtn;
            setTimeout(() => {
                let focEl = container.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focEl) focEl.focus();
                else container.focus();
            }, 10);
            document.body.setAttribute("aria-hidden", "true");
            trapFocus(container);
        });
    }
    let closeBtn = container.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            closeModal(container);
        });
    }
    container.addEventListener('mousedown', function(e) {
        if (e.target === container) {
            closeModal(container);
        }
    });
});