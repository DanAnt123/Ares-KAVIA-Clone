// progress-charts.js - Chart.js integration for progress visualization
// Usage: Call fetchAndRenderCharts() on page load or initializeProgressCharts() for specific charts

// Chart instances storage for cleanup and updates
const chartInstances = {};

// Default color scheme for consistent styling
const CHART_COLORS = {
    primary: '#FF6B35',
    secondary: '#004E89', 
    success: '#28A745',
    info: '#17A2B8',
    warning: '#FFC107',
    danger: '#DC3545',
    light: '#F8F9FA',
    dark: '#343A40'
};

// Chart.js default configuration
const DEFAULT_CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: {
                usePointStyle: true,
                padding: 20
            }
        },
        tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: CHART_COLORS.primary,
            borderWidth: 1
        }
    },
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                maxTicksLimit: 10
            }
        },
        y: {
            beginAtZero: true,
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            }
        }
    }
};

// PUBLIC_INTERFACE
function fetchAndRenderCharts() {
    /**
     * Main function to fetch data from backend API endpoints and render all charts.
     * This function should be called on page load to initialize all progress charts.
     */
    console.log('Initializing progress charts...');
    
    // Fetch and render performance summary dashboard
    fetchPerformanceSummary();
    
    // Fetch and render exercise frequency chart
    fetchExerciseFrequency();
    
    // Check if specific exercise or workout charts are requested
    const urlParams = new URLSearchParams(window.location.search);
    const exerciseName = urlParams.get('exercise');
    const workoutId = urlParams.get('workout_id');
    
    if (exerciseName) {
        fetchWeightProgression(exerciseName);
    }
    
    if (workoutId) {
        fetchVolumeTrends(workoutId);
    }
}

// PUBLIC_INTERFACE
function fetchPerformanceSummary(days = 30) {
    /**
     * Fetch and render performance summary metrics from the backend.
     * @param {number} days - Number of days to include in the summary (default: 30)
     */
    const url = `/api/progress/performance-summary?days=${days}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            renderPerformanceSummaryCharts(data);
        })
        .catch(error => {
            console.error('Error fetching performance summary:', error);
            showChartError('performance-summary-container', 'Failed to load performance summary');
        });
}

// PUBLIC_INTERFACE
function fetchWeightProgression(exerciseName) {
    /**
     * Fetch weight progression data for a specific exercise and render line chart.
     * @param {string} exerciseName - Name of the exercise to track
     */
    if (!exerciseName || exerciseName.trim() === '') {
        console.warn('fetchWeightProgression called with empty exercise name');
        showChartMessage('weight-progression-chart', 'Please select an exercise to view weight progression');
        return;
    }
    
    console.log(`Fetching weight progression for exercise: "${exerciseName}"`);
    
    const url = `/api/progress/weight-progression/${encodeURIComponent(exerciseName.trim())}`;
    console.log(`API URL: ${url}`);
    
    // Show loading state
    const canvas = document.getElementById('weight-progression-chart');
    const placeholder = document.getElementById('weight-progression-placeholder');
    if (canvas && placeholder) {
        placeholder.innerHTML = `
            <div class="chart-loading">
                <i class="fa fa-spinner fa-spin"></i>
                <p>Loading weight progression for ${exerciseName}...</p>
            </div>
        `;
    }
    
    fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin' // Include cookies for authentication
    })
        .then(response => {
            console.log(`API response status: ${response.status}`);
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in.');
            }
            if (response.status === 404) { 
                throw new Error(`Exercise "${exerciseName}" not found or no weight data available.`);
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received weight progression data:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Validate data structure
            if (!data.exercise_name) {
                throw new Error('Invalid response: missing exercise_name');
            }
            
            if (!Array.isArray(data.data_points)) {
                throw new Error('Invalid response: data_points should be an array');
            }
            
            renderWeightProgressionChart(data);
        })
        .catch(error => {
            console.error('Error fetching weight progression:', error);
            
            let errorMessage = `Failed to load weight progression for "${exerciseName}"`;
            
            if (error.message.includes('Authentication required')) {
                errorMessage = 'Please log in to view weight progression data.';
            } else if (error.message.includes('not found')) {
                errorMessage = error.message;
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else {
                errorMessage += `\n\nError details: ${error.message}`;
            }
            
            showChartError('weight-progression-chart', errorMessage);
        });
}

// PUBLIC_INTERFACE
function fetchVolumeTrends(workoutId) {
    /**
     * Fetch volume trends data for a specific workout and render line chart.
     * @param {number} workoutId - ID of the workout to analyze
     */
    const url = `/api/progress/volume-trends/${workoutId}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            renderVolumeTrendsChart(data);
        })
        .catch(error => {
            console.error('Error fetching volume trends:', error);
            showChartError('volume-trends-chart', `Failed to load volume trends for workout ${workoutId}`);
        });
}

// PUBLIC_INTERFACE
function fetchExerciseFrequency(days = 90) {
    /**
     * Fetch exercise frequency data and render pie/bar chart.
     * @param {number} days - Number of days to include in the analysis (default: 90)
     */
    const url = `/api/progress/exercise-frequency?days=${days}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            renderExerciseFrequencyChart(data);
        })
        .catch(error => {
            console.error('Error fetching exercise frequency:', error);
            showChartError('exercise-frequency-chart', 'Failed to load exercise frequency data');
        });
}

// PUBLIC_INTERFACE
function renderChart(chartId, chartType, chartData, chartOptions = {}) {
    /**
     * Create or update a Chart.js chart in the given canvas element.
     * @param {string} chartId - ID of the canvas element to render the chart
     * @param {string} chartType - Type of chart (line, bar, pie, doughnut, etc.)
     * @param {Object} chartData - Chart.js data object
     * @param {Object} chartOptions - Chart.js options object (optional)
     * @returns {Chart} Chart.js instance
     */
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        console.error(`Canvas element with ID '${chartId}' not found`);
        return null;
    }
    
    // Destroy existing chart if it exists
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Merge default options with provided options
    const mergedOptions = mergeChartOptions(DEFAULT_CHART_OPTIONS, chartOptions);
    
    // Create new chart instance
    const chart = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: mergedOptions
    });
    
    // Store chart instance for future reference
    chartInstances[chartId] = chart;
    
    return chart;
}

function renderPerformanceSummaryCharts(data) {
    /**
     * Render performance summary data as multiple chart components.
     * @param {Object} data - Performance summary data from API
     */
    // Render workout frequency pie chart
    if (data.top_workouts && data.top_workouts.length > 0) {
        const workoutData = {
            labels: data.top_workouts.map(w => w.name),
            datasets: [{
                data: data.top_workouts.map(w => w.frequency),
                backgroundColor: generateColorPalette(data.top_workouts.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
        
        renderChart('workout-frequency-chart', 'pie', workoutData, {
            plugins: {
                title: {
                    display: true,
                    text: `Most Frequent Workouts (Last ${data.period_days} Days)`
                }
            }
        });
    }
    
    // Update summary statistics in DOM
    updateSummaryStats(data);
}

function renderWeightProgressionChart(data) {
    /**
     * Render weight progression line chart for a specific exercise.
     * @param {Object} data - Weight progression data from API
     */
    console.log('Rendering weight progression chart with data:', data);
    
    if (!data.data_points || data.data_points.length === 0) {
        let message = `No weight data available for ${data.exercise_name}`;
        
        // Add debug information if available
        if (data.debug_info) {
            message += `\n\nDebug Info:`;
            message += `\n- Searched for: "${data.debug_info.searched_name}"`;
            message += `\n- Available exercises: ${data.debug_info.total_available}`;
        }
        
        if (data.available_exercises && data.available_exercises.length > 0) {
            message += `\n\nAvailable exercises with weight data:`;
            data.available_exercises.slice(0, 5).forEach(ex => {
                message += `\n- ${ex}`;
            });
            if (data.available_exercises.length > 5) {
                message += `\n... and ${data.available_exercises.length - 5} more`;
            }
        }
        
        showChartMessage('weight-progression-chart', message);
        return;
    }
    
    console.log(`Rendering chart with ${data.data_points.length} data points`);
    
    // Prepare chart data - ensure we have multiple points for a proper trend line
    const chartData = {
        labels: data.data_points.map(point => point.formatted_date),
        datasets: [{
            label: `${data.exercise_name} (kg)`,
            data: data.data_points.map(point => point.weight),
            borderColor: CHART_COLORS.primary,
            backgroundColor: data.data_points.length === 1 ? CHART_COLORS.primary : CHART_COLORS.primary + '20',
            fill: data.data_points.length > 1, // Only fill if we have multiple points
            tension: data.data_points.length > 2 ? 0.4 : 0, // Smooth curve only with 3+ points
            pointBackgroundColor: CHART_COLORS.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: data.data_points.length === 1 ? 8 : 6, // Larger points for single data point
            pointHoverRadius: data.data_points.length === 1 ? 10 : 8
        }]
    };
    
    // Calculate dynamic Y-axis range for better visualization
    const weights = data.data_points.map(point => point.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight;
    const padding = Math.max(weightRange * 0.1, 5); // 10% padding or minimum 5kg
    
    const options = {
        plugins: {
            title: {
                display: true,
                text: `Weight Progression: ${data.exercise_name}`,
                font: {
                    size: 16,
                    weight: 'bold'
                }
            },
            legend: {
                display: true,
                labels: {
                    usePointStyle: true
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const point = data.data_points[context.dataIndex];
                        let label = `Weight: ${context.parsed.y}kg`;
                        if (point.session_count && point.session_count > 1) {
                            label += ` (${point.session_count} sessions this day)`;
                        }
                        return label;
                    },
                    afterLabel: function(context) {
                        const point = data.data_points[context.dataIndex];
                        if (context.dataIndex > 0) {
                            const prevWeight = data.data_points[context.dataIndex - 1].weight;
                            const change = context.parsed.y - prevWeight;
                            if (change !== 0) {
                                const changeText = change > 0 ? `+${change.toFixed(1)}kg` : `${change.toFixed(1)}kg`;
                                return `Change: ${changeText}`;
                            }
                        }
                        return null;
                    }
                }
            }
        },
        scales: {
            y: {
                min: data.data_points.length === 1 ? 0 : Math.max(0, minWeight - padding),
                max: maxWeight + padding,
                title: {
                    display: true,
                    text: 'Weight (kg)',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date',
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                },
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        elements: {
            line: {
                borderWidth: data.data_points.length === 1 ? 0 : 3 // No line for single point
            }
        }
    };
    
    // Add progression stats to chart subtitle if available
    if (data.progression_stats && data.data_points.length > 1) {
        const stats = data.progression_stats;
        const subtitle = `Total progression: ${stats.total_progression > 0 ? '+' : ''}${stats.total_progression}kg (${stats.progression_percentage > 0 ? '+' : ''}${stats.progression_percentage}%) | Average: ${stats.average_weight}kg`;
        
        options.plugins.subtitle = {
            display: true,
            text: subtitle,
            font: {
                size: 12
            },
            color: stats.total_progression >= 0 ? CHART_COLORS.success : CHART_COLORS.danger
        };
    }
    
    renderChart('weight-progression-chart', 'line', chartData, options);
    
    // Log successful render
    console.log(`Successfully rendered weight progression chart for ${data.exercise_name} with ${data.data_points.length} data points`);
}

function renderVolumeTrendsChart(data) {
    /**
     * Render volume trends line chart for a specific workout.
     * @param {Object} data - Volume trends data from API
     */
    if (!data.data_points || data.data_points.length === 0) {
        showChartMessage('volume-trends-chart', `No volume data available for ${data.workout_name}`);
        return;
    }
    
    const chartData = {
        labels: data.data_points.map(point => point.formatted_date),
        datasets: [{
            label: 'Total Volume (kg)',
            data: data.data_points.map(point => point.volume),
            borderColor: CHART_COLORS.info,
            backgroundColor: CHART_COLORS.info + '20',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: CHART_COLORS.info,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6
        }]
    };
    
    const options = {
        plugins: {
            title: {
                display: true,
                text: `Volume Trends: ${data.workout_name}`
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Volume (kg)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date'
                }
            }
        }
    };
    
    renderChart('volume-trends-chart', 'line', chartData, options);
}

function renderExerciseFrequencyChart(data) {
    /**
     * Render exercise frequency chart as horizontal bar chart.
     * @param {Object} data - Exercise frequency data from API
     */
    if (!data.exercises || data.exercises.length === 0) {
        showChartMessage('exercise-frequency-chart', 'No exercise frequency data available');
        return;
    }
    
    // Take top 10 exercises to avoid overcrowding
    const topExercises = data.exercises.slice(0, 10);
    
    const chartData = {
        labels: topExercises.map(ex => ex.exercise_name),
        datasets: [{
            label: 'Frequency',
            data: topExercises.map(ex => ex.frequency),
            backgroundColor: generateColorPalette(topExercises.length),
            borderWidth: 1,
            borderColor: '#fff'
        }]
    };
    
    const options = {
        indexAxis: 'y', // Horizontal bar chart
        plugins: {
            title: {
                display: true,
                text: `Exercise Frequency (Last ${data.period_days} Days)`
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Times Performed'
                }
            }
        }
    };
    
    renderChart('exercise-frequency-chart', 'bar', chartData, options);
}

function updateSummaryStats(data) {
    /**
     * Update summary statistics in the DOM elements.
     * @param {Object} data - Performance summary data
     */
    const statsElements = {
        'total-sessions': data.total_sessions,
        'total-exercises': data.total_exercises,
        'total-volume': data.total_volume ? `${data.total_volume.toLocaleString()} kg` : '0 kg',
        'sessions-per-week': data.averages ? data.averages.sessions_per_week : '0',
        'avg-exercises-per-session': data.averages ? data.averages.exercises_per_session : '0',
        'unique-exercises': data.unique_exercises || 0
    };
    
    for (const [elementId, value] of Object.entries(statsElements)) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
}

function generateColorPalette(count) {
    /**
     * Generate a color palette for charts with the specified number of colors.
     * @param {number} count - Number of colors needed
     * @returns {Array} Array of color strings
     */
    const baseColors = [
        CHART_COLORS.primary,
        CHART_COLORS.secondary,
        CHART_COLORS.success,
        CHART_COLORS.info,
        CHART_COLORS.warning,
        CHART_COLORS.danger
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        if (i < baseColors.length) {
            colors.push(baseColors[i]);
        } else {
            // Generate additional colors using HSL
            const hue = (i * 137.508) % 360; // Golden angle approximation
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
    }
    
    return colors;
}

function mergeChartOptions(defaultOptions, customOptions) {
    /**
     * Deep merge chart options objects.
     * @param {Object} defaultOptions - Default chart options
     * @param {Object} customOptions - Custom chart options to merge
     * @returns {Object} Merged options object
     */
    const merged = JSON.parse(JSON.stringify(defaultOptions));
    
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    
    deepMerge(merged, customOptions);
    return merged;
}

function showChartError(chartId, message) {
    /**
     * Display error message in place of chart.
     * @param {string} chartId - ID of the chart container or canvas
     * @param {string} message - Error message to display
     */
    const container = document.getElementById(chartId) || document.getElementById(chartId + '-container');
    if (container) {
        container.innerHTML = `
            <div class="chart-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>${message}</p>
            </div>
        `;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.minHeight = '200px';
    }
}

function showChartMessage(chartId, message) {
    /**
     * Display informational message in place of chart.
     * @param {string} chartId - ID of the chart container or canvas
     * @param {string} message - Message to display
     */
    const container = document.getElementById(chartId) || document.getElementById(chartId + '-container');
    if (container) {
        container.innerHTML = `
            <div class="chart-message">
                <i class="fa-solid fa-info-circle"></i>
                <p>${message}</p>
            </div>
        `;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.minHeight = '200px';
    }
}

// PUBLIC_INTERFACE
function destroyAllCharts() {
    /**
     * Destroy all chart instances to free up memory.
     * Call this when navigating away from the charts page.
     */
    for (const chartId in chartInstances) {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
    }
}

// PUBLIC_INTERFACE
function refreshChart(chartId) {
    /**
     * Refresh a specific chart by re-fetching its data.
     * @param {string} chartId - ID of the chart to refresh
     */
    switch (chartId) {
        case 'performance-summary':
            fetchPerformanceSummary();
            break;
        case 'exercise-frequency-chart':
            fetchExerciseFrequency();
            break;
        case 'weight-progression-chart':
            const exerciseName = new URLSearchParams(window.location.search).get('exercise');
            if (exerciseName) {
                fetchWeightProgression(exerciseName);
            }
            break;
        case 'volume-trends-chart':
            const workoutId = new URLSearchParams(window.location.search).get('workout_id');
            if (workoutId) {
                fetchVolumeTrends(workoutId);
            }
            break;
        default:
            console.warn(`Unknown chart ID: ${chartId}`);
    }
}

// Export functions for global access
window.fetchAndRenderCharts = fetchAndRenderCharts;
window.renderChart = renderChart;
window.fetchPerformanceSummary = fetchPerformanceSummary;
window.fetchWeightProgression = fetchWeightProgression;
window.fetchVolumeTrends = fetchVolumeTrends;
window.fetchExerciseFrequency = fetchExerciseFrequency;
window.destroyAllCharts = destroyAllCharts;
window.refreshChart = refreshChart;

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on a page with chart containers
    const chartContainers = document.querySelectorAll('[id$="-chart"], [id$="-container"]');
    if (chartContainers.length > 0) {
        console.log('Chart containers found, initializing progress charts...');
        fetchAndRenderCharts();
    }
});
