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

// Enhanced save function with congratulations popup only after last exercise
function saveCompleteExerciseWithProgressUpdate(exerciseId, workoutId, exerciseData, exerciseCard) {
    showExerciseSaveStatus(exerciseCard, 'saving');
    
    // Get exercise index to check if this is the last one
    const exerciseIndex = parseInt(exerciseCard.dataset.exerciseIndex);
    
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
            
            // Update the original data attributes to reflect saved state
            const weightInput = exerciseCard.querySelector('.weight-field');
            const repsInput = exerciseCard.querySelector('.reps-field');
            const detailsInput = exerciseCard.querySelector('.details-field');
            
            if (weightInput) weightInput.dataset.originalWeight = exerciseData.weight;
            if (repsInput) repsInput.dataset.originalReps = exerciseData.reps;
            if (detailsInput) detailsInput.dataset.originalDetails = exerciseData.details;
            
            // Show success notification
            showSuccessNotification(exerciseCard, 'Exercise saved and marked as complete!');
            
            // Check if this is the last exercise and show congratulations if so
            checkForWorkoutCompletion(workoutId, exerciseIndex);
            
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

// PUBLIC_INTERFACE
/**
 * Check if this is the last exercise in the workout and trigger celebration if so.
 * Only shows congratulations popup after the LAST exercise has been saved.
 */
function checkForWorkoutCompletion(workoutId, exerciseIndex) {
    const workoutContainer = document.querySelector(`.workout-${workoutId}`);
    if (!workoutContainer) return;
    
    const exerciseCards = workoutContainer.querySelectorAll('.exercise-card-modern');
    const totalExercises = exerciseCards.length;
    
    // Check if this is the last exercise (by index)
    if (exerciseIndex === totalExercises - 1) {
        // This is the last exercise, show congratulations
        showWorkoutCompletionCelebration(workoutId);
    }
}

// PUBLIC_INTERFACE
/**
 * Show celebration when the last exercise is completed.
 */
function showWorkoutCompletionCelebration(workoutId) {
    const workoutContainer = document.querySelector(`.workout-${workoutId}`);
    if (!workoutContainer) return;
    
    // Avoid showing multiple celebrations
    if (workoutContainer.dataset.celebrationShown === 'true') return;
    workoutContainer.dataset.celebrationShown = 'true';
    
    // Create celebration overlay
    const celebration = document.createElement('div');
    celebration.className = 'workout-completion-celebration';
    celebration.innerHTML = `
        <div class="celebration-content">
            <div class="celebration-icon">
                <i class="fa-solid fa-trophy"></i>
            </div>
            <h3 class="celebration-title">Workout Complete!</h3>
            <p class="celebration-message">Amazing job! You've completed your workout.</p>
            <div class="celebration-confetti">
                <div class="confetti-piece"></div>
                <div class="confetti-piece"></div>
                <div class="confetti-piece"></div>
                <div class="confetti-piece"></div>
                <div class="confetti-piece"></div>
            </div>
        </div>
    `;
    
    celebration.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.5s ease-out;
    `;
    
    // Add celebration styles
    const celebrationStyles = `
        .celebration-content {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 2rem;
            border-radius: 1rem;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
        }
        .celebration-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: bounce 1s infinite;
        }
        .celebration-title {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            font-weight: bold;
        }
        .celebration-message {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        .celebration-confetti {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        .confetti-piece {
            position: absolute;
            width: 10px;
            height: 10px;
            background: #ffd700;
            animation: confettiFall 3s linear infinite;
        }
        .confetti-piece:nth-child(1) { left: 10%; animation-delay: 0s; background: #ff6b6b; }
        .confetti-piece:nth-child(2) { left: 30%; animation-delay: 0.5s; background: #4ecdc4; }
        .confetti-piece:nth-child(3) { left: 50%; animation-delay: 1s; background: #45b7d1; }
        .confetti-piece:nth-child(4) { left: 70%; animation-delay: 1.5s; background: #96ceb4; }
        .confetti-piece:nth-child(5) { left: 90%; animation-delay: 2s; background: #feca57; }
        @keyframes confettiFall {
            0% { transform: translateY(-100vh) rotate(0deg); }
            100% { transform: translateY(100vh) rotate(360deg); }
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-30px); }
            60% { transform: translateY(-15px); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    
    // Add styles to document
    const styleSheet = document.createElement('style');
    styleSheet.textContent = celebrationStyles;
    document.head.appendChild(styleSheet);
    
    document.body.appendChild(celebration);
    
    // Remove celebration after delay
    setTimeout(() => {
        celebration.style.opacity = '0';
        setTimeout(() => {
            celebration.remove();
            styleSheet.remove();
            // Reset celebration flag after some time
            setTimeout(() => {
                workoutContainer.dataset.celebrationShown = 'false';
            }, 30000); // 30 seconds
        }, 500);
    }, 4000);
    
    // Allow clicking to dismiss
    celebration.addEventListener('click', () => {
        celebration.style.opacity = '0';
        setTimeout(() => {
            celebration.remove();
            styleSheet.remove();
            workoutContainer.dataset.celebrationShown = 'false';
        }, 300);
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
