/**
 * Workout History Interactive Management System
 * Handles AJAX filtering, real-time content updates, client-side sorting, and search functionality
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
        const exerciseNames = Array.from(sessionCard.querySelectorAll('.exercise-name'))
            .map(el => el.textContent.trim())
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
        }
        
        if (this.exerciseFilter) {
            this.exerciseFilter.addEventListener('change', () => this.handleExerciseFilter());
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
        
        // Session expansion
        this.setupSessionExpansion();
        
        // Modal functionality
        this.setupModalHandlers();
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
         * Handle workout filter changes
         */
        this.activeFiltersObj.workout = this.workoutFilter.value;
        this.applyFilters();
    }

    // PUBLIC_INTERFACE
    handleExerciseFilter() {
        /**
         * Handle exercise filter changes
         */
        this.activeFiltersObj.exercise = this.exerciseFilter.value;
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
                filtered = filtered.filter(session => 
                    session.workoutId === this.activeFiltersObj.workout
                );
            }

            // Apply exercise filter
            if (this.activeFiltersObj.exercise) {
                filtered = filtered.filter(session => {
                    const exercises = session.element.querySelectorAll('.exercise-card');
                    return Array.from(exercises).some(exercise => {
                        const exerciseName = exercise.dataset.exerciseName;
                        return exerciseName && exerciseName.trim().toUpperCase() === 
                            this.activeFiltersObj.exercise.trim().toUpperCase();
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
                        .map(e => e.dataset.exerciseName).sort();
                    const bExercises = Array.from(b.element.querySelectorAll('.exercise-card'))
                        .map(e => e.dataset.exerciseName).sort();
                    return aExercises[0]?.localeCompare(bExercises[0] || '') || 0;
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
    showMessage(message, type) {
        /**
         * Show a temporary message to the user
         */
        const messageEl = document.createElement('div');
        messageEl.className = `toast-message toast-${type}`;
        messageEl.innerHTML = `
            <div class="toast-content">
                <i class="fa fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(messageEl);
        
        // Animate in
        setTimeout(() => messageEl.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
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
