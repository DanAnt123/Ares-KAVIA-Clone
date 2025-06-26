/* Workout Progress Bar Fix - Only updates after successful saves */

// Remove real-time progress updates and only update after manual saves
document.addEventListener('DOMContentLoaded', function() {
    // Override the original progress update functions to prevent auto-updates
    
    // Disable progress updates on input changes
    document.querySelectorAll('.interactive-input').forEach(input => {
        // Remove any existing input event listeners that update progress
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        // Add back only the validation listener, no progress updates
        newInput.addEventListener('focus', function() {
            clearValidationErrors(this.closest('.exercise-card-modern'));
        });
    });
    
    // Override quick log functionality to remove progress updates
    document.querySelectorAll('.quick-log-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const originalHandler = this.onclick;
            this.onclick = null;
            
            const exerciseIndex = this.dataset.exerciseIndex;
            const exerciseCard = this.closest('.exercise-card-modern');
            const weightInput = exerciseCard.querySelector('.weight-field');
            const repsInput = exerciseCard.querySelector('.reps-field');
            const detailsInput = exerciseCard.querySelector('.details-field');
            
            // Enable all input fields
            if (weightInput) {
                weightInput.disabled = false;
                weightInput.readOnly = false;
                weightInput.classList.add('field-enabled');
            }
            if (repsInput) {
                repsInput.disabled = false;
                repsInput.readOnly = false;
                repsInput.classList.add('field-enabled');
            }
            if (detailsInput) {
                detailsInput.disabled = false;
                detailsInput.readOnly = false;
                detailsInput.classList.add('field-enabled');
            }
            
            // Enable quick fill buttons
            const quickFillButtons = exerciseCard.querySelectorAll('.quick-fill-last-session');
            quickFillButtons.forEach(button => {
                button.disabled = false;
            });
            
            // Fill with last session data if available
            const lastWeight = weightInput?.dataset.lastWeight;
            if (lastWeight && weightInput) {
                weightInput.value = lastWeight;
            }
            
            const lastReps = repsInput?.dataset.lastReps;
            if (lastReps && repsInput) {
                repsInput.value = lastReps;
            }
            
            // Add visual feedback to exercise card
            exerciseCard.classList.add('exercise-enabled');
            
            // Update exercise status badge
            const statusBadge = exerciseCard.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge active';
                statusBadge.innerHTML = '<i class="fa-solid fa-edit"></i> Active';
            }
            
            // Focus on weight input
            if (weightInput) {
                weightInput.focus();
            }
            
            // Visual feedback for quick log button
            this.style.background = '#059669';
            this.innerHTML = '<i class="fa-solid fa-check"></i> Enabled';
            this.disabled = true;
            
            // Show notification
            showQuickLogNotification(exerciseCard, 'Exercise enabled and filled with last session data!');
            
            // NO PROGRESS UPDATE HERE - removed the updateProgressDisplayFallback call
        });
    });
    
    // Override quick fill functionality to remove progress updates
    document.querySelectorAll('.quick-fill-last-session').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = this.dataset.target;
            const value = this.dataset.value;
            const targetInput = document.getElementById(targetId);
            
            if (targetInput && value) {
                // Fill the input with previous session value
                targetInput.value = value;
                targetInput.focus();
                
                // Trigger input event but no progress update
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Show visual feedback
                this.style.background = '#059669';
                this.textContent = '✓';
                
                // Reset button after delay
                setTimeout(() => {
                    this.style.background = '#10b981';
                    this.textContent = 'Last';
                }, 1500);
                
                // NO PROGRESS UPDATE HERE - removed the updateProgressDisplayFallback call
            }
        });
    });
    
    // Override badge click functionality to remove progress updates
    document.querySelectorAll('.previous-session-badge').forEach(badge => {
        badge.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Find the corresponding input field
            const inputGroup = this.closest('.input-group-modern');
            const inputField = inputGroup.querySelector('.metric-input-field');
            const quickFillBtn = inputGroup.querySelector('.quick-fill-last-session');
            
            if (inputField && !inputField.disabled && !inputField.readOnly) {
                // If there's a quick fill button, use its value
                if (quickFillBtn) {
                    const value = quickFillBtn.dataset.value;
                    if (value) {
                        inputField.value = value;
                        inputField.focus();
                        
                        // Trigger input event but no progress update
                        inputField.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        // Show badge feedback
                        this.style.transform = 'scale(1.1)';
                        this.style.opacity = '1';
                        
                        setTimeout(() => {
                            this.style.transform = '';
                            this.style.opacity = '';
                        }, 300);
                        
                        // NO PROGRESS UPDATE HERE - removed the updateProgressDisplayFallback call
                    }
                }
            } else {
                // If input is disabled, show notification
                showBadgeClickNotification(badge, 'Click "Quick Log" to enable editing first');
            }
        });
        
        // Add hover effect to indicate clickability
        badge.style.cursor = 'pointer';
        badge.title = 'Click to fill input with previous session value';
    });
    
    // Ensure save buttons work correctly and only they update progress
    document.querySelectorAll('.save-exercise-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const exerciseId = this.dataset.exerciseId;
            const workoutId = this.dataset.workoutId;
            const exerciseIndex = this.dataset.exerciseIndex;
            
            // Find the exercise card
            const exerciseCard = this.closest('.exercise-card-modern');
            if (!exerciseCard) return;
            
            // Collect all field values
            const weightInput = exerciseCard.querySelector('.weight-field');
            const repsInput = exerciseCard.querySelector('.reps-field');
            const detailsInput = exerciseCard.querySelector('.details-field');
            
            const exerciseData = {
                weight: weightInput ? weightInput.value.trim() : '',
                reps: repsInput ? repsInput.value.trim() : '',
                details: detailsInput ? detailsInput.value.trim() : ''
            };
            
            // Validate required fields
            const validationResult = validateExerciseData(exerciseData);
            if (!validationResult.isValid) {
                showValidationError(exerciseCard, validationResult.message);
                return;
            }
            
            // Save the exercise - this will update progress on success
            saveCompleteExerciseWithProgressUpdate(exerciseId, workoutId, exerciseData, exerciseCard);
        });
    });
});

// Enhanced save function that updates progress only after successful save
function saveCompleteExerciseWithProgressUpdate(exerciseId, workoutId, exerciseData, exerciseCard) {
    showExerciseSaveStatus(exerciseCard, 'saving');
    
    // Save all exercise fields
    fetch('/workout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            workout_id: workoutId,
            exercise_id: exerciseId,
            exercise_data: exerciseData,
            action: 'save_complete_exercise'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showExerciseSaveStatus(exerciseCard, 'success');
            
            // Update exercise status badge to completed
            updateExerciseStatusBadge(exerciseCard, true);
            
            // ONLY NOW UPDATE PROGRESS - after successful save
            if (data.completion_status) {
                updateProgressWithBackendData(workoutId, data.completion_status);
            } else {
                updateProgressDisplay(workoutId);
            }
            
            // Show success notification
            showSuccessNotification(exerciseCard, 'Exercise saved and marked as complete!');
            
        } else {
            showExerciseSaveStatus(exerciseCard, 'error');
            console.error('Save failed:', data.errors || data.error);
            
            // Show user-friendly error
            if (data.errors && data.errors.length > 0) {
                showValidationError(exerciseCard, data.errors[0]);
            } else if (data.error) {
                showValidationError(exerciseCard, data.error);
            }
        }
    })
    .catch(error => {
        console.error('Network error:', error);
        showExerciseSaveStatus(exerciseCard, 'error');
        showValidationError(exerciseCard, 'Network error - please try again');
    });
}

// Helper functions for notifications
function showQuickLogNotification(exerciseCard, message) {
    const notification = document.createElement('div');
    notification.className = 'exercise-quicklog-notification';
    notification.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${message}`;
    
    exerciseCard.style.position = 'relative';
    exerciseCard.appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showBadgeClickNotification(badge, message) {
    const notification = document.createElement('div');
    notification.className = 'badge-click-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        white-space: nowrap;
        z-index: 1000;
        animation: fadeInOut 2s ease-out forwards;
    `;
    
    badge.style.position = 'relative';
    badge.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// CSS for the fadeInOut animation
const style = document.createElement('style');
style.textContent = `
@keyframes fadeInOut {
    0% {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
    }
    20%, 80% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
    100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
    }
}

.exercise-quicklog-notification {
    position: absolute;
    top: 10px;
    left: 10px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    z-index: 1000;
    animation: slideInLeft 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

@keyframes slideInLeft {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
`;
document.head.appendChild(style);
