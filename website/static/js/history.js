/**
 * Workout History Interactive Management System
 * Handles AJAX filtering, real-time content updates, client-side sorting, and search functionality
 *
 * FILTER LOGIC NOTE (2024-06 FIX):
 * - All filter logic (workout, exercise, etc.) uses strict normalization (trim and lowercase).
 * - For workout, both workoutId and workoutName are compared (normalized).
 * - For exercise, matches if any .exercise-card or .exercise-log-item descendant has a normalized data-exercise-name or textContent equal to the filter.
 * - Patch robust to DOM attribute and casing discrepancies, after issues caused by exercise value normalization update in prior commits.
 */

// PUBLIC_INTERFACE
class WorkoutHistoryManager {
    /**
     * Initialize the workout history management system with advanced filtering and sorting capabilities
     */
    constructor() {
        // Core elements
        this.sessionsContainer = document.getElementById('sessions-container');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.emptyState = document.getElementById('empty-state');
        this.noResults = document.getElementById('no-results');
        this.historyContent = document.getElementById('history-content');
        
        // Filter and sort controls
        this.workoutFilter = document.getElementById('workout-filter');
        this.exerciseFilter = document.getElementById('exercise-filter');
        this.dateFilter = document.getElementById('date-filter');
        this.sortBy = document.getElementById('sort-by');
        this.searchInput = document.getElementById('search-input');
        this.clearSearchBtn = document.getElementById('clear-search');
        
        // View controls
        this.viewGridBtn = document.getElementById('view-grid');
        this.viewListBtn = document.getElementById('view-list');
        
        // Action buttons
        this.refreshBtn = document.getElementById('refresh-data');
        this.exportBtn = document.getElementById('export-data');
        this.clearFiltersBtn = document.getElementById('clear-filters');
        this.resetFiltersBtn = document.getElementById('reset-filters');
        this.clearHistoryBtn = document.getElementById('clear-all-history');
        
        // Clear history modal elements
        this.clearHistoryModal = document.getElementById('clear-history-modal');
        this.clearModalClose = document.getElementById('clear-modal-close');
        this.clearModalCancel = document.getElementById('clear-modal-cancel');
        this.clearModalConfirm = document.getElementById('clear-modal-confirm');
        this.clearConfirmationInput = document.getElementById('clear-confirmation-input');
        
        // Results info
        this.resultsCount = document.getElementById('results-count');
        this.activeFilters = document.getElementById('active-filters');
        
        // Session modal
        this.sessionModal = document.getElementById('session-modal');
        this.modalContent = document.getElementById('modal-session-content');
        
        // Data storage
        this.allSessions = [];
        this.filteredSessions = [];
        this.currentView = 'grid';
        this.activeFiltersObj = {
            workout: '',
            exercise: '',
            date: '',
            search: '',
            sort: 'date-desc'
        };
        
        // Performance optimization
        this.searchTimeout = null;
        this.lastUpdate = Date.now();
        
        this.init();
    }

    // PUBLIC_INTERFACE
    init() {
        /**
         * Initialize all functionality and load initial data
         */
        this.loadInitialData();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupPerformanceOptimizations();
        
        // Auto-refresh every 5 minutes if page is visible
        this.setupAutoRefresh();
    }

    // PUBLIC_INTERFACE
    loadInitialData() {
        /**
         * Load initial session data from the DOM and prepare for manipulation
         */
        const sessionCards = document.querySelectorAll('.session-card');
        this.allSessions = Array.from(sessionCards).map(card => {
            return {
                id: card.dataset.sessionId,
                workoutId: card.dataset.workoutId,
                workoutName: card.dataset.workoutName,
                timestamp: new Date(card.dataset.timestamp),
                element: card,
                exerciseCount: card.querySelectorAll('.exercise-log-item').length,
                searchText: this.buildSearchText(card)
            };
        });
        
        this.filteredSessions = [...this.allSessions];
        this.updateResultsInfo();
    }

    // PUBLIC_INTERFACE
    buildSearchText(sessionCard) {
        /**
         * Build searchable text content from session card for efficient searching
         */
        const workoutName = sessionCard.dataset.workoutName || '';
        const exerciseNames = Array.from(sessionCard.querySelectorAll('[data-exercise-name]'))
            .map(el => el.dataset.exerciseName || el.textContent.trim())
            .join(' ');
        const exerciseDetails = Array.from(sessionCard.querySelectorAll('.exercise-details'))
            .map(el => el.textContent.trim())
            .join(' ');
        const notes = Array.from(sessionCard.querySelectorAll('.exercise-notes'))
            .map(el => el.textContent.trim())
            .join(' ');
            
        return `${workoutName} ${exerciseNames} ${exerciseDetails} ${notes}`.toLowerCase();
    }

    // PUBLIC_INTERFACE
    setupEventListeners() {
        /**
         * Setup all event listeners for interactive functionality
         */
        // Filter controls
        if (this.workoutFilter) {
            this.workoutFilter.addEventListener('change', () => this.handleWorkoutFilter());
            // Initialize from URL if present
            const urlParams = new URLSearchParams(window.location.search);
            const workoutId = urlParams.get('workout_id');
            if (workoutId && this.workoutFilter.querySelector(`option[value="${workoutId}"]`)) {
                this.workoutFilter.value = workoutId;
                this.activeFiltersObj.workout = workoutId;
            }
        }
        
        if (this.exerciseFilter) {
            this.exerciseFilter.addEventListener('change', () => this.handleExerciseFilter());
            // Preserve exercise filter across page reloads
            const lastExercise = sessionStorage.getItem('lastExerciseFilter');
            if (lastExercise && this.exerciseFilter.querySelector(`option[value="${lastExercise}"]`)) {
                this.exerciseFilter.value = lastExercise;
                this.activeFiltersObj.exercise = lastExercise;
            }
        }
        
        if (this.dateFilter) {
            this.dateFilter.addEventListener('change', () => this.handleDateFilter());
        }
        
        if (this.sortBy) {
            this.sortBy.addEventListener('change', () => this.handleSort());
        }
        
        // Search functionality
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.handleSearch());
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }
        
        if (this.clearSearchBtn) {
            this.clearSearchBtn.addEventListener('click', () => this.clearSearch());
        }
        
        // View controls
        if (this.viewGridBtn) {
            this.viewGridBtn.addEventListener('click', () => this.setView('grid'));
        }
        
        if (this.viewListBtn) {
            this.viewListBtn.addEventListener('click', () => this.setView('list'));
        }
        
        // Action buttons
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => this.refreshData());
        }
        
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportData());
        }
        
        if (this.clearFiltersBtn) {
            this.clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
        }
        
        if (this.resetFiltersBtn) {
            this.resetFiltersBtn.addEventListener('click', () => this.clearAllFilters());
        }
        
        if (this.clearHistoryBtn) {
            this.clearHistoryBtn.addEventListener('click', () => this.showClearHistoryModal());
        }
        
        // Session expansion
        this.setupSessionExpansion();
        
        // Modal functionality
        this.setupModalHandlers();
        
        // Clear history modal functionality
        this.setupClearHistoryModal();
    }

    // PUBLIC_INTERFACE
    setupSessionExpansion() {
        /**
         * Setup click handlers for expanding/collapsing session details
         */
        document.addEventListener('click', (e) => {
            const expandBtn = e.target.closest('.expand-btn');
            if (expandBtn) {
                e.preventDefault();
                const sessionId = expandBtn.dataset.sessionId;
                this.toggleSessionDetails(sessionId);
            }
            
            // Handle session card click for mobile
            const sessionCard = e.target.closest('.session-card');
            if (sessionCard && window.innerWidth <= 768 && !e.target.closest('.session-actions')) {
                const sessionId = sessionCard.dataset.sessionId;
                this.showSessionModal(sessionId);
            }
        });
    }

    // PUBLIC_INTERFACE
    setupModalHandlers() {
        /**
         * Setup modal functionality for detailed session view
         */
        if (this.sessionModal) {
            // Close modal handlers
            const closeBtn = this.sessionModal.querySelector('.modal-close-btn');
            const overlay = this.sessionModal.querySelector('.modal-overlay');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeSessionModal());
            }
            
            if (overlay) {
                overlay.addEventListener('click', () => this.closeSessionModal());
            }
            
            // Keyboard navigation
            this.sessionModal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeSessionModal();
                }
            });
        }
    }

    // PUBLIC_INTERFACE
    setupClearHistoryModal() {
        /**
         * Setup clear history modal functionality with confirmation validation
         */
        if (!this.clearHistoryModal) return;
        
        // Close modal handlers
        if (this.clearModalClose) {
            this.clearModalClose.addEventListener('click', () => this.closeClearHistoryModal());
        }
        
        if (this.clearModalCancel) {
            this.clearModalCancel.addEventListener('click', () => this.closeClearHistoryModal());
        }
        
        // Confirmation input validation
        if (this.clearConfirmationInput) {
            this.clearConfirmationInput.addEventListener('input', () => this.validateClearConfirmation());
            this.clearConfirmationInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.clearModalConfirm && !this.clearModalConfirm.disabled) {
                    this.confirmClearHistory();
                }
            });
        }
        
        // Confirm button handler
        if (this.clearModalConfirm) {
            this.clearModalConfirm.addEventListener('click', () => this.confirmClearHistory());
        }
        
        // Modal overlay click to close
        this.clearHistoryModal.addEventListener('click', (e) => {
            if (e.target === this.clearHistoryModal) {
                this.closeClearHistoryModal();
            }
        });
        
        // Keyboard navigation
        this.clearHistoryModal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeClearHistoryModal();
            }
        });
    }

    // PUBLIC_INTERFACE
    setupKeyboardShortcuts() {
        /**
         * Setup keyboard shortcuts for power users
         */
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'f':
                        e.preventDefault();
                        this.searchInput?.focus();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportData();
                        break;
                }
            }
            
            switch (e.key) {
                case 'g':
                    this.setView('grid');
                    break;
                case 'l':
                    this.setView('list');
                    break;
                case 'Escape':
                    this.clearSearch();
                    break;
            }
        });
    }

    // PUBLIC_INTERFACE
    setupPerformanceOptimizations() {
        /**
         * Setup performance optimizations for smooth user experience
         */
        // Intersection Observer for lazy loading session details
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const sessionCard = entry.target;
                        this.preloadSessionData(sessionCard);
                    }
                });
            }, { rootMargin: '50px' });
            
            // Observe all session cards
            this.allSessions.forEach(session => {
                this.intersectionObserver.observe(session.element);
            });
        }
    }

    // PUBLIC_INTERFACE
    setupAutoRefresh() {
        /**
         * Setup automatic data refresh when page becomes visible
         */
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && Date.now() - this.lastUpdate > 300000) { // 5 minutes
                this.refreshData();
            }
        });
    }

    // PUBLIC_INTERFACE
    handleWorkoutFilter() {
        /**
         * Handle workout filter changes and update UI state
         */
        const selectedWorkout = this.workoutFilter.value;
        this.activeFiltersObj.workout = selectedWorkout;
        
        // Update URL without reloading
        const url = new URL(window.location.href);
        if (selectedWorkout) {
            url.searchParams.set('workout_id', selectedWorkout);
        } else {
            url.searchParams.delete('workout_id');
        }
        window.history.pushState({}, '', url);
        
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    handleExerciseFilter() {
        /**
         * Handle exercise filter changes and persist selection
         */
        const selectedExercise = this.exerciseFilter.value;
        this.activeFiltersObj.exercise = selectedExercise;
        
        // Persist selection
        if (selectedExercise) {
            sessionStorage.setItem('lastExerciseFilter', selectedExercise);
        } else {
            sessionStorage.removeItem('lastExerciseFilter');
        }
        
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    handleDateFilter() {
        /**
         * Handle date range filter changes
         */
        this.activeFiltersObj.date = this.dateFilter.value;
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    handleSort() {
        /**
         * Handle sort option changes
         */
        this.activeFiltersObj.sort = this.sortBy.value;
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    handleSearch() {
        /**
         * Handle search input with debouncing for performance
         */
        clearTimeout(this.searchTimeout);
        
        this.searchTimeout = setTimeout(() => {
            this.activeFiltersObj.search = this.searchInput.value.trim().toLowerCase();
            
            // Show/hide clear search button
            if (this.clearSearchBtn) {
                this.clearSearchBtn.style.display = this.activeFiltersObj.search ? 'flex' : 'none';
            }
            
            this.applyFilters();
        }, 300);
    }

    // PUBLIC_INTERFACE
    clearSearch() {
        /**
         * Clear search input and reset search filter
         */
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        
        if (this.clearSearchBtn) {
            this.clearSearchBtn.style.display = 'none';
        }
        
        this.activeFiltersObj.search = '';
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    applyFilters() {
        /**
         * Apply all active filters and sort options to session data
         */
        this.showLoading();
        
        // Use requestAnimationFrame for smooth UI updates
        requestAnimationFrame(() => {
            let filtered = [...this.allSessions];
            
            // Apply workout filter
            if (this.activeFiltersObj.workout) {
                // Use normalized comparison for workoutId and string values.
                const filterVal = String(this.activeFiltersObj.workout).trim().toLowerCase();
                filtered = filtered.filter(session => {
                    let workoutId = String(session.workoutId).trim().toLowerCase();
                    // Additionally, allow comparison to workout name for robustness.
                    let workoutName = (session.workoutName || "").trim().toLowerCase();
                    return workoutId === filterVal || workoutName === filterVal;
                });
            }

            // Apply exercise filter
            if (this.activeFiltersObj.exercise) {
                // Normalize filter and DOM exercise names: trimmed and lowercased
                const searchExercise = this.activeFiltersObj.exercise.trim().toLowerCase();
                filtered = filtered.filter(session => {
                    // Try both .exercise-card and .exercise-log-item, robust to variations.
                    const exercises = Array.from(session.element.querySelectorAll('.exercise-card,[data-exercise-name],.exercise-log-item'));
                    return exercises.some(exercise => {
                        // Use data-exercise-name OR fall back to .exercise-name's text
                        let exerciseName = 
                            (typeof exercise.dataset.exerciseName !== "undefined" && exercise.dataset.exerciseName)
                            ? exercise.dataset.exerciseName
                            : (exercise.querySelector?.('.exercise-name')?.textContent || exercise.textContent || '');
                        if (typeof exerciseName !== "string") exerciseName = "";
                        exerciseName = exerciseName.trim().toLowerCase();
                        return exerciseName === searchExercise;
                    });
                });
            }
            
            // Apply date filter
            if (this.activeFiltersObj.date) {
                filtered = this.applyDateFilter(filtered);
            }
            
            // Apply search filter
            if (this.activeFiltersObj.search) {
                filtered = filtered.filter(session =>
                    session.searchText.includes(this.activeFiltersObj.search)
                );
            }
            
            // Apply sorting
            filtered = this.applySorting(filtered);
            
            this.filteredSessions = filtered;
            this.updateDisplay();
            this.updateResultsInfo();
            this.updateActiveFiltersDisplay();
            this.hideLoading();
        });
    }

    // PUBLIC_INTERFACE
    applyDateFilter(sessions) {
        /**
         * Apply date range filtering to sessions
         */
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (this.activeFiltersObj.date) {
            case 'today':
                return sessions.filter(session => session.timestamp >= today);
                
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                return sessions.filter(session => session.timestamp >= weekStart);
                
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                return sessions.filter(session => session.timestamp >= monthStart);
                
            case 'quarter':
                const quarterStart = new Date(today);
                quarterStart.setMonth(today.getMonth() - 3);
                return sessions.filter(session => session.timestamp >= quarterStart);
                
            default:
                return sessions;
        }
    }

    // PUBLIC_INTERFACE
    applySorting(sessions) {
        /**
         * Apply sorting to filtered sessions
         */
        switch (this.activeFiltersObj.sort) {
            case 'date-asc':
                return sessions.sort((a, b) => a.timestamp - b.timestamp);
                
            case 'date-desc':
                return sessions.sort((a, b) => b.timestamp - a.timestamp);
                
            case 'workout-name':
                return sessions.sort((a, b) => a.workoutName.localeCompare(b.workoutName));
                
            case 'exercise-count':
                return sessions.sort((a, b) => b.exerciseCount - a.exerciseCount);
                
            case 'exercise-name':
                return sessions.sort((a, b) => {
                    const aExercises = Array.from(a.element.querySelectorAll('.exercise-card'))
                        .map(e => e.dataset.exerciseName || '')
                        .filter(name => name)
                        .sort();
                    const bExercises = Array.from(b.element.querySelectorAll('.exercise-card'))
                        .map(e => e.dataset.exerciseName || '')
                        .filter(name => name)
                        .sort();
                    
                    // Handle cases where one or both sessions have no exercises
                    if (!aExercises.length && !bExercises.length) return 0;
                    if (!aExercises.length) return 1;
                    if (!bExercises.length) return -1;
                    
                    // Compare first exercise names
                    return aExercises[0].localeCompare(bExercises[0]);
                });
                
            default:
                return sessions;
        }
    }

    // PUBLIC_INTERFACE
    updateDisplay() {
        /**
         * Update the visual display based on filtered results
         */
        if (this.filteredSessions.length === 0) {
            this.showNoResults();
        } else {
            this.showResults();
            this.renderSessions();
        }
    }

    // PUBLIC_INTERFACE
    renderSessions() {
        /**
         * Render the filtered and sorted sessions in the container
         */
        // Hide all sessions first
        this.allSessions.forEach(session => {
            session.element.style.display = 'none';
        });
        
        // Show filtered sessions in correct order
        this.filteredSessions.forEach((session, index) => {
            session.element.style.display = 'block';
            session.element.style.order = index;
        });
        
        // Trigger animations for newly visible items
        this.animateVisibleSessions();
    }

    // PUBLIC_INTERFACE
    animateVisibleSessions() {
        /**
         * Add entrance animations to visible sessions
         */
        this.filteredSessions.forEach((session, index) => {
            session.element.style.animationDelay = `${index * 0.05}s`;
            session.element.classList.remove('session-animate-in');
            
            // Force reflow and add animation class
            session.element.offsetHeight;
            session.element.classList.add('session-animate-in');
        });
    }

    // PUBLIC_INTERFACE
    showResults() {
        /**
         * Show the results container and hide empty states
         */
        if (this.sessionsContainer) {
            this.sessionsContainer.style.display = 'grid';
        }
        
        if (this.noResults) {
            this.noResults.style.display = 'none';
        }
        
        if (this.emptyState) {
            this.emptyState.style.display = 'none';
        }
    }

    // PUBLIC_INTERFACE
    showNoResults() {
        /**
         * Show no results message and hide sessions container
         */
        if (this.sessionsContainer) {
            this.sessionsContainer.style.display = 'none';
        }
        
        if (this.noResults) {
            this.noResults.style.display = 'flex';
        }
        
        if (this.emptyState) {
            this.emptyState.style.display = 'none';
        }
    }

    // PUBLIC_INTERFACE
    updateResultsInfo() {
        /**
         * Update results count and filtering information
         */
        if (this.resultsCount) {
            const count = this.filteredSessions.length;
            const total = this.allSessions.length;
            
            if (count === total) {
                this.resultsCount.textContent = `${count} sessions found`;
            } else {
                this.resultsCount.textContent = `${count} of ${total} sessions`;
            }
        }
    }

    // PUBLIC_INTERFACE
    updateActiveFiltersDisplay() {
        /**
         * Update the display of active filters
         */
        const activeFilters = [];
        
        // Add workout filter if active
        if (this.activeFiltersObj.workout) {
            const workoutName = this.workoutFilter?.options[this.workoutFilter.selectedIndex]?.text;
            if (workoutName) {
                activeFilters.push(`Workout: ${workoutName}`);
            }
        }

        // Add exercise filter if active
        if (this.activeFiltersObj.exercise) {
            const exerciseName = this.exerciseFilter?.options[this.exerciseFilter.selectedIndex]?.text;
            if (exerciseName) {
                activeFilters.push(`Exercise: ${exerciseName}`);
            }
        }
        
        if (this.activeFiltersObj.date) {
            const dateLabel = this.dateFilter?.options[this.dateFilter.selectedIndex]?.text;
            if (dateLabel) {
                activeFilters.push(`Date: ${dateLabel}`);
            }
        }
        
        if (this.activeFiltersObj.search) {
            activeFilters.push(`Search: "${this.activeFiltersObj.search}"`);
        }
        
        if (this.activeFilters) {
            if (activeFilters.length === 0) {
                this.activeFilters.textContent = 'No filters applied';
            } else {
                this.activeFilters.textContent = activeFilters.join(', ');
            }
        }
        
        // Show/hide clear filters button
        const hasActiveFilters = activeFilters.length > 0;
        if (this.clearFiltersBtn) {
            this.clearFiltersBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
        }
    }

    // PUBLIC_INTERFACE
    clearAllFilters() {
        /**
         * Clear all active filters and reset to default state
         */
        this.activeFiltersObj = {
            workout: '',
            exercise: '',
            date: '',
            search: '',
            sort: 'date-desc'
        };
        
        // Reset form controls
        if (this.workoutFilter) this.workoutFilter.value = '';
        if (this.exerciseFilter) this.exerciseFilter.value = '';
        if (this.dateFilter) this.dateFilter.value = '';
        if (this.sortBy) this.sortBy.value = 'date-desc';
        if (this.searchInput) this.searchInput.value = '';
        if (this.clearSearchBtn) this.clearSearchBtn.style.display = 'none';
        
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    setView(viewType) {
        /**
         * Switch between grid and list view modes
         */
        this.currentView = viewType;
        
        if (this.sessionsContainer) {
            this.sessionsContainer.className = `sessions-container view-${viewType}`;
        }
        
        // Update view button states
        if (this.viewGridBtn && this.viewListBtn) {
            this.viewGridBtn.classList.toggle('active', viewType === 'grid');
            this.viewListBtn.classList.toggle('active', viewType === 'list');
        }
        
        // Store preference
        localStorage.setItem('historyViewPreference', viewType);
    }

    // PUBLIC_INTERFACE
    toggleSessionDetails(sessionId) {
        /**
         * Toggle the expanded details for a specific session
         */
        const detailsElement = document.getElementById(`session-details-${sessionId}`);
        const expandBtn = document.querySelector(`[data-session-id="${sessionId}"]`);
        
        if (detailsElement && expandBtn) {
            const isExpanded = detailsElement.style.display !== 'none';
            
            if (isExpanded) {
                detailsElement.style.display = 'none';
                expandBtn.innerHTML = '<i class="fa fa-chevron-down"></i>';
                expandBtn.title = 'View Details';
            } else {
                detailsElement.style.display = 'block';
                expandBtn.innerHTML = '<i class="fa fa-chevron-up"></i>';
                expandBtn.title = 'Hide Details';
                
                // Smooth scroll to show details
                detailsElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest' 
                });
            }
        }
    }

    // PUBLIC_INTERFACE
    showSessionModal(sessionId) {
        /**
         * Show session details in modal for mobile/enhanced view
         */
        const session = this.allSessions.find(s => s.id === sessionId);
        if (!session || !this.sessionModal) return;
        
        // Clone session details content
        const detailsElement = document.getElementById(`session-details-${sessionId}`);
        if (detailsElement && this.modalContent) {
            this.modalContent.innerHTML = detailsElement.innerHTML;
        }
        
        // Show modal
        this.sessionModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus management
        setTimeout(() => {
            const closeBtn = this.sessionModal.querySelector('.modal-close-btn');
            if (closeBtn) closeBtn.focus();
        }, 100);
    }

    // PUBLIC_INTERFACE
    closeSessionModal() {
        /**
         * Close the session details modal
         */
        if (this.sessionModal) {
            this.sessionModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    // PUBLIC_INTERFACE
    refreshData() {
        /**
         * Refresh session data via AJAX
         */
        this.showLoading();
        
        // Add visual feedback
        if (this.refreshBtn) {
            this.refreshBtn.classList.add('spinning');
        }
        
        fetch('/api/workout/history', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            this.updateSessionsFromAPI(data);
            this.lastUpdate = Date.now();
            this.showSuccessMessage('Workout history refreshed successfully');
        })
        .catch(error => {
            console.error('Failed to refresh data:', error);
            this.showErrorMessage('Failed to refresh workout history. Please try again.');
        })
        .finally(() => {
            this.hideLoading();
            if (this.refreshBtn) {
                this.refreshBtn.classList.remove('spinning');
            }
        });
    }

    // PUBLIC_INTERFACE
    updateSessionsFromAPI(apiData) {
        /**
         * Update session data from API response
         */
        // This would involve updating the DOM with new session data
        // For now, we'll just reload the page to get the latest data
        window.location.reload();
    }

    // PUBLIC_INTERFACE
    exportData() {
        /**
         * Export filtered workout history data
         */
        if (this.filteredSessions.length === 0) {
            this.showErrorMessage('No data to export. Please adjust your filters.');
            return;
        }
        
        const exportData = this.prepareExportData();
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workout-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccessMessage('Workout history exported successfully');
    }

    // PUBLIC_INTERFACE
    prepareExportData() {
        /**
         * Prepare session data for export
         */
        return {
            exportDate: new Date().toISOString(),
            totalSessions: this.filteredSessions.length,
            filters: this.activeFiltersObj,
            sessions: this.filteredSessions.map(session => ({
                id: session.id,
                workoutName: session.workoutName,
                timestamp: session.timestamp.toISOString(),
                exerciseCount: session.exerciseCount
            }))
        };
    }

    // PUBLIC_INTERFACE
    preloadSessionData(sessionCard) {
        /**
         * Preload session data for better performance
         */
        // Mark as preloaded to avoid duplicate processing
        if (!sessionCard.dataset.preloaded) {
            sessionCard.dataset.preloaded = 'true';
            // Additional preloading logic could go here
        }
    }

    // PUBLIC_INTERFACE
    showLoading() {
        /**
         * Show loading indicator
         */
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }
    }

    // PUBLIC_INTERFACE
    hideLoading() {
        /**
         * Hide loading indicator
         */
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    // PUBLIC_INTERFACE
    showSuccessMessage(message) {
        /**
         * Show success message to user
         */
        this.showMessage(message, 'success');
    }

    // PUBLIC_INTERFACE
    showErrorMessage(message) {
        /**
         * Show error message to user
         */
        this.showMessage(message, 'error');
    }

    // PUBLIC_INTERFACE
    showWarningMessage(message) {
        /**
         * Show warning message to user
         */
        this.showMessage(message, 'warning');
    }

    // PUBLIC_INTERFACE
    showMessage(message, type) {
        /**
         * Show a temporary message to the user with enhanced styling and positioning
         */
        // Remove any existing toast of the same type to prevent overlapping
        const existingToast = document.querySelector(`.toast-message.toast-${type}`);
        if (existingToast) {
            existingToast.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `toast-message toast-${type}`;
        
        // Determine icon based on message type
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        else if (type === 'error') icon = 'exclamation-circle';
        else if (type === 'warning') icon = 'exclamation-triangle';
        else if (type === 'progress') icon = 'spinner fa-spin';
        
        messageEl.innerHTML = `
            <div class="toast-content">
                <i class="fa fa-${icon}"></i>
                <span>${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `;
        
        // Add to toast container or create one
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(messageEl);
        
        // Animate in
        setTimeout(() => messageEl.classList.add('show'), 10);
        
        // Auto remove (longer for error messages)
        const autoRemoveTime = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, autoRemoveTime);
        
        // Add accessibility attributes
        messageEl.setAttribute('role', 'alert');
        messageEl.setAttribute('aria-live', 'polite');
        if (type === 'error') {
            messageEl.setAttribute('aria-live', 'assertive');
        }
    }

    // PUBLIC_INTERFACE
    showClearHistoryModal() {
        /**
         * Show the clear history confirmation modal with edge case validation
         */
        if (!this.clearHistoryModal) {
            this.showErrorMessage('Clear history modal is not available. Please refresh the page.');
            return;
        }
        
        // Edge case: Check if there's any history to clear
        if (this.allSessions.length === 0) {
            this.showWarningMessage('No workout history to clear. Start tracking some workouts first!');
            return;
        }
        
        // Reset modal state completely
        this.resetModalState();
        
        // Update modal content with current session count
        const sessionCount = this.allSessions.length;
        const modalTitle = this.clearHistoryModal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = `
                <i class="fa fa-exclamation-triangle"></i>
                Clear All Workout History (${sessionCount} session${sessionCount !== 1 ? 's' : ''})
            `;
        }
        
        // Show modal with animation
        this.clearHistoryModal.style.display = 'flex';
        this.clearHistoryModal.classList.add('modal-entering');
        document.body.style.overflow = 'hidden';
        
        // Focus management with accessibility
        setTimeout(() => {
            if (this.clearConfirmationInput) {
                this.clearConfirmationInput.focus();
                this.clearConfirmationInput.setAttribute('aria-describedby', 'clear-confirmation-help');
            }
            this.clearHistoryModal.classList.remove('modal-entering');
        }, 100);
        
        // Add escape key handler
        this.modalEscapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeClearHistoryModal();
            }
        };
        document.addEventListener('keydown', this.modalEscapeHandler);
    }
    
    // PUBLIC_INTERFACE
    resetModalState() {
        /**
         * Reset the modal to its initial state
         */
        if (this.clearConfirmationInput) {
            this.clearConfirmationInput.value = '';
            this.clearConfirmationInput.disabled = false;
            this.clearConfirmationInput.classList.remove('error');
        }
        
        if (this.clearModalConfirm) {
            this.clearModalConfirm.disabled = true;
            this.clearModalConfirm.innerHTML = '<i class="fa fa-trash"></i> Clear All History';
            this.clearModalConfirm.classList.remove('loading');
        }
        
        if (this.clearModalCancel) {
            this.clearModalCancel.disabled = false;
            this.clearModalCancel.innerHTML = '<i class="fa fa-times"></i> Cancel';
        }
        
        if (this.clearModalClose) {
            this.clearModalClose.disabled = false;
        }
        
        // Remove any error states
        const errorElements = this.clearHistoryModal.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());
    }

    // PUBLIC_INTERFACE
    closeClearHistoryModal() {
        /**
         * Close the clear history confirmation modal with proper cleanup
         */
        if (!this.clearHistoryModal) return;
        
        // Add closing animation
        this.clearHistoryModal.classList.add('modal-exiting');
        
        setTimeout(() => {
            this.clearHistoryModal.style.display = 'none';
            this.clearHistoryModal.classList.remove('modal-exiting');
            document.body.style.overflow = '';
            
            // Clean up event listeners
            if (this.modalEscapeHandler) {
                document.removeEventListener('keydown', this.modalEscapeHandler);
                this.modalEscapeHandler = null;
            }
            
            // Reset form state completely
            this.resetModalState();
            
            // Hide any progress toasts
            this.hideProgressToast();
            
            // Return focus to the clear history button
            if (this.clearHistoryBtn) {
                this.clearHistoryBtn.focus();
            }
        }, 200);
    }

    // PUBLIC_INTERFACE
    validateClearConfirmation() {
        /**
         * Validate the confirmation input and enable/disable confirm button
         */
        if (!this.clearConfirmationInput || !this.clearModalConfirm) return;
        
        const inputValue = this.clearConfirmationInput.value.trim().toUpperCase();
        const requiredText = 'CLEAR HISTORY';
        
        this.clearModalConfirm.disabled = inputValue !== requiredText;
    }

    // PUBLIC_INTERFACE
    confirmClearHistory() {
        /**
         * Execute the clear history action after confirmation with comprehensive error handling
         */
        if (!this.clearModalConfirm || this.clearModalConfirm.disabled) return;
        
        // Edge case: Check if there's actually history to clear
        if (this.allSessions.length === 0) {
            this.showErrorMessage('No workout history to clear.');
            this.closeClearHistoryModal();
            return;
        }
        
        // Store original button state for restoration
        const originalText = this.clearModalConfirm.innerHTML;
        const originalDisabled = this.clearModalConfirm.disabled;
        
        // Disable all modal controls during operation
        this.setModalLoadingState(true);
        
        // Show comprehensive loading indicators
        this.showGlobalLoadingState();
        this.clearModalConfirm.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Clearing History...';
        this.clearModalConfirm.disabled = true;
        
        // Disable the cancel button to prevent interruption
        if (this.clearModalCancel) {
            this.clearModalCancel.disabled = true;
        }
        
        // Show progress toast
        this.showProgressToast('Clearing workout history...');
        
        // Add timeout handling for network issues
        const timeoutId = setTimeout(() => {
            this.handleClearHistoryTimeout();
        }, 30000); // 30 second timeout
        
        // Call the clear history API with enhanced error handling
        fetch('/api/workout/history/clear', {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            clearTimeout(timeoutId);
            
            // Handle different HTTP status codes
            if (response.status === 404) {
                throw new Error('Clear history endpoint not found. Please contact support.');
            } else if (response.status === 401 || response.status === 403) {
                throw new Error('You are not authorized to perform this action. Please sign in again.');
            } else if (response.status === 500) {
                throw new Error('Server error occurred. Please try again later.');
            } else if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
        })
        .then(data => {
            // Validate response data
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response from server');
            }
            
            if (data.success) {
                // Handle successful deletion
                const sessionsDeleted = data.sessions_deleted || 0;
                
                this.closeClearHistoryModal();
                this.hideGlobalLoadingState();
                
                if (sessionsDeleted === 0) {
                    this.showWarningMessage('No workout sessions were found to delete.');
                } else {
                    this.showSuccessMessage(`Successfully cleared ${sessionsDeleted} workout session${sessionsDeleted !== 1 ? 's' : ''}`);
                }
                
                // Update local state immediately
                this.handleSuccessfulClear();
                
                // Refresh the page after a brief delay to ensure user sees the success message
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                // Handle server-side errors
                const errorMessage = data.error || data.message || 'Unknown error occurred';
                throw new Error(errorMessage);
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Failed to clear workout history:', error);
            
            // Determine error type and show appropriate message
            let errorMessage = 'Failed to clear workout history. Please try again.';
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. The server may be busy, please try again later.';
            } else if (error.message.includes('authorized')) {
                errorMessage = error.message;
            } else if (error.message.includes('endpoint not found')) {
                errorMessage = error.message;
            } else if (error.message.length > 10 && error.message.length < 200) {
                errorMessage = error.message;
            }
            
            this.showErrorMessage(errorMessage);
            
            // Reset modal state for retry
            this.resetModalAfterError(originalText, originalDisabled);
        })
        .finally(() => {
            clearTimeout(timeoutId);
            this.hideGlobalLoadingState();
            this.setModalLoadingState(false);
        });
    }
    
    // PUBLIC_INTERFACE
    setModalLoadingState(isLoading) {
        /**
         * Set loading state for the entire modal
         */
        if (!this.clearHistoryModal) return;
        
        const modalContent = this.clearHistoryModal.querySelector('.modal-content');
        if (modalContent) {
            if (isLoading) {
                modalContent.classList.add('loading');
            } else {
                modalContent.classList.remove('loading');
            }
        }
        
        // Disable/enable form inputs
        if (this.clearConfirmationInput) {
            this.clearConfirmationInput.disabled = isLoading;
        }
        
        if (this.clearModalCancel) {
            this.clearModalCancel.disabled = isLoading;
        }
        
        if (this.clearModalClose) {
            this.clearModalClose.disabled = isLoading;
        }
    }
    
    // PUBLIC_INTERFACE
    showGlobalLoadingState() {
        /**
         * Show global loading overlay during critical operations
         */
        let overlay = document.getElementById('global-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'global-loading-overlay';
            overlay.className = 'global-loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner">
                        <i class="fa fa-spinner fa-spin fa-3x"></i>
                    </div>
                    <div class="loading-text">Processing request...</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }
    
    // PUBLIC_INTERFACE
    hideGlobalLoadingState() {
        /**
         * Hide global loading overlay
         */
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    // PUBLIC_INTERFACE
    showProgressToast(message) {
        /**
         * Show a progress toast message
         */
        const toastId = 'progress-toast';
        let existingToast = document.getElementById(toastId);
        
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast-message toast-progress';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fa fa-spinner fa-spin"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
    }
    
    // PUBLIC_INTERFACE
    hideProgressToast() {
        /**
         * Hide progress toast message
         */
        const toast = document.getElementById('progress-toast');
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    // PUBLIC_INTERFACE
    handleClearHistoryTimeout() {
        /**
         * Handle timeout during clear history operation
         */
        this.showErrorMessage('Request timed out. The operation may still be in progress. Please refresh the page to check the status.');
        this.resetModalAfterError('<i class="fa fa-trash"></i> Clear All History', false);
    }
    
    // PUBLIC_INTERFACE
    resetModalAfterError(originalText, originalDisabled) {
        /**
         * Reset modal state after an error for retry capability
         */
        this.hideProgressToast();
        
        if (this.clearModalConfirm) {
            this.clearModalConfirm.innerHTML = originalText;
            this.clearModalConfirm.disabled = originalDisabled;
        }
        
        if (this.clearModalCancel) {
            this.clearModalCancel.disabled = false;
        }
        
        if (this.clearModalClose) {
            this.clearModalClose.disabled = false;
        }
        
        if (this.clearConfirmationInput) {
            this.clearConfirmationInput.disabled = false;
        }
    }
    
    // PUBLIC_INTERFACE
    handleSuccessfulClear() {
        /**
         * Handle successful clear operation by updating local state
         */
        this.hideProgressToast();
        
        // Clear local session data
        this.allSessions = [];
        this.filteredSessions = [];
        
        // Update UI immediately to show empty state
        if (this.sessionsContainer) {
            this.sessionsContainer.style.display = 'none';
        }
        
        if (this.emptyState) {
            this.emptyState.style.display = 'flex';
        }
        
        if (this.noResults) {
            this.noResults.style.display = 'none';
        }
        
        // Update results info
        this.updateResultsInfo();
        
        // Clear any active filters since there's no data
        this.clearAllFilters();
        
        // Disable clear history button
        if (this.clearHistoryBtn) {
            this.clearHistoryBtn.disabled = true;
            this.clearHistoryBtn.title = 'No history to clear';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the history page
    if (document.getElementById('sessions-container') || document.getElementById('empty-state')) {
        window.historyManager = new WorkoutHistoryManager();
    }
});

// Handle page visibility changes for auto-refresh
document.addEventListener('visibilitychange', () => {
    if (window.historyManager && !document.hidden) {
        // Refresh data if page has been hidden for more than 5 minutes
        const timeSinceLastUpdate = Date.now() - (window.historyManager.lastUpdate || 0);
        if (timeSinceLastUpdate > 300000) {
            window.historyManager.refreshData();
        }
    }
});
