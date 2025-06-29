// Enhanced Alert System for Authentication Pages
document.addEventListener('DOMContentLoaded', function() {
    initializeAlerts();
    initializeFormEnhancements();
});

function initializeAlerts() {
    const alerts = document.querySelectorAll('.alert');
    
    alerts.forEach(alert => {
        const alertClose = alert.querySelector('.alert-close');
        
        if (alertClose) {
            alertClose.addEventListener('click', function(e) {
                e.preventDefault();
                dismissAlert(alert);
            });
        }
        
        // Auto-dismiss alerts after 5 seconds
        setTimeout(() => {
            if (alert.parentElement && alert.classList.contains('show')) {
                dismissAlert(alert);
            }
        }, 5000);
        
        // Add show class for animation
        setTimeout(() => {
            alert.classList.add('show');
        }, 100);
    });
}

function dismissAlert(alert) {
    alert.style.opacity = '0';
    alert.style.transform = 'translateY(-20px)';
    alert.style.transition = 'all 0.3s ease-out';
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 300);
}

function createAlert(type, message) {
    const alertsSection = document.querySelector('.alerts-section') || document.querySelector('.auth-form-section');
    
    if (!alertsSection) return;
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} show`;
    alertElement.setAttribute('role', 'alert');
    alertElement.setAttribute('aria-live', 'polite');
    
    const iconClass = type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle';
    
    alertElement.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <span class="alert-message">${message}</span>
        </div>
        <button type="button" class="alert-close" aria-label="Close alert">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    
    // Insert at the beginning of alerts section
    alertsSection.insertBefore(alertElement, alertsSection.firstChild);
    
    // Initialize the new alert
    const alertClose = alertElement.querySelector('.alert-close');
    if (alertClose) {
        alertClose.addEventListener('click', function(e) {
            e.preventDefault();
            dismissAlert(alertElement);
        });
    }
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertElement.parentElement) {
            dismissAlert(alertElement);
        }
    }, 5000);
    
    return alertElement;
}

function initializeFormEnhancements() {
    // Password toggle functionality
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
            if (input) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                const icon = this.querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
                
                // Add visual feedback
                this.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            }
        });
    });
    
    // Enhanced form validation
    const forms = document.querySelectorAll('.auth-form');
    forms.forEach(form => {
        const inputs = form.querySelectorAll('.form-input');
        
        inputs.forEach(input => {
            // Real-time validation
            input.addEventListener('input', function() {
                validateInput(this);
            });
            
            input.addEventListener('blur', function() {
                validateInput(this);
            });
            
            input.addEventListener('focus', function() {
                const wrapper = this.parentElement;
                wrapper.classList.add('focused');
                
                // Remove any error states on focus
                wrapper.classList.remove('invalid');
            });
            
            input.addEventListener('blur', function() {
                const wrapper = this.parentElement;
                if (!this.value) {
                    wrapper.classList.remove('focused');
                }
            });
        });
        
        // Form submission handling
        form.addEventListener('submit', function(e) {
            let isValid = true;
            
            inputs.forEach(input => {
                if (!validateInput(input)) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                createAlert('error', 'Please correct the errors in the form before submitting.');
                
                // Focus on first invalid input
                const firstInvalid = form.querySelector('.input-wrapper.invalid input');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
            } else {
                // Add loading state to submit button
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.classList.add('loading');
                    submitBtn.disabled = true;
                    
                    const originalText = submitBtn.querySelector('span').textContent;
                    submitBtn.querySelector('span').textContent = 'Signing in...';
                    
                    // Reset on error (form will reload on success)
                    setTimeout(() => {
                        submitBtn.classList.remove('loading');
                        submitBtn.disabled = false;
                        submitBtn.querySelector('span').textContent = originalText;
                    }, 3000);
                }
            }
        });
    });
    
    // Enhanced button interactions
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                if (ripple.parentElement) {
                    ripple.remove();
                }
            }, 600);
        });
    });
    
    // Checkbox enhancements
    const checkboxes = document.querySelectorAll('.checkbox-input');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const label = this.nextElementSibling;
            if (label) {
                label.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    label.style.transform = 'scale(1)';
                }, 150);
            }
        });
    });
}

function validateInput(input) {
    const wrapper = input.parentElement;
    const isValid = input.checkValidity() && input.value.trim().length > 0;
    
    // Remove previous states
    wrapper.classList.remove('valid', 'invalid');
    
    if (input.value.length > 0) {
        if (isValid) {
            wrapper.classList.add('valid');
        } else {
            wrapper.classList.add('invalid');
        }
    }
    
    // Custom validation messages
    if (!isValid && input.value.length > 0) {
        let message = '';
        
        if (input.type === 'email' && input.value.length > 0) {
            message = 'Please enter a valid email address.';
        } else if (input.type === 'password' && input.value.length > 0 && input.value.length < 6) {
            message = 'Password must be at least 6 characters long.';
        } else if (input.required && input.value.length === 0) {
            message = 'This field is required.';
        }
        
        // Show custom validation message
        if (message) {
            showFieldError(input, message);
        }
    } else {
        hideFieldError(input);
    }
    
    return isValid;
}

function showFieldError(input, message) {
    hideFieldError(input); // Remove existing error
    
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: var(--error-bg);
        font-size: var(--fs-xs);
        margin-top: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: rgba(220, 38, 38, 0.1);
        border: 1px solid var(--error-border);
        border-radius: var(--radius-base);
        animation: slideInDown 0.3s ease-out;
    `;
    
    input.parentElement.appendChild(errorElement);
}

function hideFieldError(input) {
    const existingError = input.parentElement.querySelector('.field-error');
    if (existingError) {
        existingError.style.opacity = '0';
        existingError.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            if (existingError.parentElement) {
                existingError.remove();
            }
        }, 200);
    }
}

// Keyboard navigation enhancements
document.addEventListener('keydown', function(e) {
    // Close alerts with Escape key
    if (e.key === 'Escape') {
        const visibleAlerts = document.querySelectorAll('.alert.show');
        visibleAlerts.forEach(alert => {
            dismissAlert(alert);
        });
    }
    
    // Submit form with Ctrl+Enter
    if (e.ctrlKey && e.key === 'Enter') {
        const activeForm = document.querySelector('.auth-form');
        if (activeForm) {
            const submitBtn = activeForm.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
            }
        }
    }
});

// Expose functions globally for potential external use
window.AlertSystem = {
    createAlert,
    dismissAlert,
    validateInput
};
