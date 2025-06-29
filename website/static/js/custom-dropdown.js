/**
 * Modern Custom Dropdown Component
 * 
 * This component provides a fully accessible, keyboard-navigable dropdown
 * that replaces standard HTML select elements with enhanced UX features.
 * 
 * Features:
 * - Full keyboard navigation (Tab, Enter, Arrow keys, Escape)
 * - ARIA accessibility attributes
 * - Search/filter functionality
 * - Smooth animations and transitions
 * - Mobile-responsive design
 * - Event delegation for dynamic content
 * - Integration with existing forms
 * 
 * Usage:
 *   new CustomDropdown(selectElement, options)
 * 
 * Dependencies:
 *   - custom-dropdown.css
 *   - Modern browser with ES6+ support
 */

class CustomDropdown {
    constructor(selectElement, options = {}) {
        this.originalSelect = selectElement;
        this.options = {
            placeholder: 'Select an option...',
            searchable: false,
            maxHeight: 300,
            animationDuration: 200,
            ...options
        };
        
        // State management
        this.isOpen = false;
        this.selectedIndex = -1;
        this.focusedIndex = -1;
        this.searchTerm = '';
        this.searchTimeout = null;
        
        // Bind methods to preserve 'this' context
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleTriggerClick = this.handleTriggerClick.bind(this);
        this.handleOptionClick = this.handleOptionClick.bind(this);
        
        this.init();
    }
    
    /**
     * Initialize the custom dropdown
     */
    init() {
        if (!this.originalSelect) {
            console.error('CustomDropdown: No select element provided');
            return;
        }
        
        this.createDropdownStructure();
        this.populateOptions();
        this.attachEventListeners();
        this.setInitialValue();
        
        // Hide original select
        this.originalSelect.style.display = 'none';
        this.originalSelect.classList.add('original-select');
    }
    
    /**
     * Create the HTML structure for the custom dropdown
     */
    createDropdownStructure() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'custom-dropdown-container';
        this.container.setAttribute('role', 'combobox');
        this.container.setAttribute('aria-expanded', 'false');
        this.container.setAttribute('aria-haspopup', 'listbox');
        
        // Create trigger button
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'dropdown-trigger';
        this.trigger.setAttribute('aria-label', 'Select category');
        this.trigger.setAttribute('aria-describedby', this.originalSelect.getAttribute('aria-describedby') || '');
        
        // Create trigger text
        this.triggerText = document.createElement('span');
        this.triggerText.className = 'dropdown-text placeholder';
        this.triggerText.textContent = this.options.placeholder;
        
        // Create arrow
        this.arrow = document.createElement('span');
        this.arrow.className = 'dropdown-arrow';
        this.arrow.setAttribute('aria-hidden', 'true');
        
        // Create dropdown menu
        this.menu = document.createElement('div');
        this.menu.className = 'dropdown-menu';
        this.menu.setAttribute('role', 'listbox');
        this.menu.setAttribute('aria-multiselectable', 'false');
        this.menu.style.maxHeight = this.options.maxHeight + 'px';
        
        // Assemble structure
        this.trigger.appendChild(this.triggerText);
        this.trigger.appendChild(this.arrow);
        this.container.appendChild(this.trigger);
        this.container.appendChild(this.menu);
        
        // Insert after original select
        this.originalSelect.parentNode.insertBefore(this.container, this.originalSelect.nextSibling);
        
        // Copy relevant attributes
        if (this.originalSelect.id) {
            this.container.id = this.originalSelect.id + '_custom';
            this.trigger.id = this.originalSelect.id + '_trigger';
            this.menu.id = this.originalSelect.id + '_menu';
        }
        
        if (this.originalSelect.hasAttribute('required')) {
            this.container.setAttribute('aria-required', 'true');
        }
        
        if (this.originalSelect.hasAttribute('disabled')) {
            this.disable();
        }
    }
    
    /**
     * Populate dropdown options from the original select
     */
    populateOptions() {
        this.menu.innerHTML = '';
        this.optionElements = [];
        
        const selectOptions = Array.from(this.originalSelect.options);
        
        if (selectOptions.length === 0) {
            this.showEmptyState();
            return;
        }
        
        selectOptions.forEach((option, index) => {
            if (option.disabled && option.value === '') {
                // Skip placeholder options
                return;
            }
            
            const optionElement = this.createOptionElement(option, index);
            this.menu.appendChild(optionElement);
            this.optionElements.push(optionElement);
        });
        
        if (this.optionElements.length === 0) {
            this.showEmptyState();
        }
    }
    
    /**
     * Create a single option element
     */
    createOptionElement(option, index) {
        const optionElement = document.createElement('div');
        optionElement.className = 'dropdown-option';
        optionElement.setAttribute('role', 'option');
        optionElement.setAttribute('aria-selected', 'false');
        optionElement.setAttribute('data-value', option.value);
        optionElement.setAttribute('data-index', index);
        optionElement.tabIndex = -1; // Make focusable for keyboard navigation
        
        if (option.disabled) {
            optionElement.classList.add('disabled');
            optionElement.setAttribute('aria-disabled', 'true');
        }
        
        // Create option content
        const optionContent = document.createElement('div');
        optionContent.className = 'dropdown-option-with-icon';
        
        // Add icon if specified in data attribute
        const iconClass = option.getAttribute('data-icon');
        if (iconClass) {
            const iconElement = document.createElement('i');
            iconElement.className = `dropdown-option-icon ${iconClass}`;
            iconElement.setAttribute('aria-hidden', 'true');
            optionContent.appendChild(iconElement);
        }
        
        // Add text content
        const textElement = document.createElement('span');
        textElement.className = 'dropdown-option-text';
        textElement.textContent = option.textContent;
        optionContent.appendChild(textElement);
        
        optionElement.appendChild(optionContent);
        
        // Store the index for event delegation
        optionElement.setAttribute('data-option-index', index);
        
        return optionElement;
    }
    
    /**
     * Show empty state message
     */
    showEmptyState() {
        this.menu.innerHTML = '<div class="dropdown-empty">No options available</div>';
    }
    
    /**
     * Show loading state
     */
    showLoadingState() {
        this.menu.innerHTML = '<div class="dropdown-loading">Loading options...</div>';
        this.menu.classList.add('loading');
    }
    
    /**
     * Show error state
     */
    showErrorState(message = 'Failed to load options') {
        this.menu.innerHTML = `<div class="dropdown-error">${message}</div>`;
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Trigger click
        this.trigger.addEventListener('click', this.handleTriggerClick);
        
        // Keyboard navigation
        this.container.addEventListener('keydown', this.handleKeydown);
        
        // Single event listener for option selection using event delegation
        this.menu.addEventListener('click', this.handleOptionClick);
=======
        // Ensure menu container has proper pointer events
        this.menu.style.pointerEvents = 'auto';
        
        // Close on outside click
        document.addEventListener('click', this.handleDocumentClick);
        
        // Handle form reset
        if (this.originalSelect.form) {
            this.originalSelect.form.addEventListener('reset', () => {
                setTimeout(() => this.setInitialValue(), 0);
            });
        }
        
        // Watch for changes to original select
        const observer = new MutationObserver(() => {
            this.populateOptions();
            this.updateSelectedOption();
        });
        
        observer.observe(this.originalSelect, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['selected', 'disabled']
        });
        

    }
    
    /**
     * Handle trigger button click
     */
    handleTriggerClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.container.hasAttribute('disabled')) {
            return;
        }
        
        this.toggle();
    }
    
    /**
     * Handle option click
     */
    handleOptionClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const optionElement = event.target.closest('.dropdown-option');
        
        if (!optionElement || optionElement.classList.contains('disabled')) {
            return;
        }
        
        const index = parseInt(optionElement.getAttribute('data-option-index'));
        
        if (!isNaN(index) && index >= 0) {
            this.selectOption(index);
            this.close();
        }
    }
    
    /**
     * Handle keyboard navigation
     */
    handleKeydown(event) {
        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (!this.isOpen) {
                    this.open();
                } else if (this.focusedIndex >= 0) {
                    this.selectOption(this.focusedIndex);
                    this.close();
                }
                break;
                
            case 'Escape':
                if (this.isOpen) {
                    event.preventDefault();
                    this.close();
                    this.trigger.focus();
                }
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                if (!this.isOpen) {
                    this.open();
                } else {
                    this.focusNextOption();
                }
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                if (!this.isOpen) {
                    this.open();
                } else {
                    this.focusPreviousOption();
                }
                break;
                
            case 'Home':
                if (this.isOpen) {
                    event.preventDefault();
                    this.focusFirstOption();
                }
                break;
                
            case 'End':
                if (this.isOpen) {
                    event.preventDefault();
                    this.focusLastOption();
                }
                break;
                
            case 'Tab':
                if (this.isOpen) {
                    this.close();
                }
                break;
                
            default:
                // Type-ahead search
                if (this.isOpen && event.key.length === 1) {
                    this.handleTypeAhead(event.key);
                }
                break;
        }
    }
    
    /**
     * Handle type-ahead search
     */
    handleTypeAhead(char) {
        clearTimeout(this.searchTimeout);
        this.searchTerm += char.toLowerCase();
        
        // Find matching option
        const matchingIndex = this.optionElements.findIndex(option => {
            const text = option.textContent.toLowerCase();
            return text.startsWith(this.searchTerm) && !option.classList.contains('disabled');
        });
        
        if (matchingIndex >= 0) {
            this.setFocusedOption(matchingIndex);
        }
        
        // Clear search term after delay
        this.searchTimeout = setTimeout(() => {
            this.searchTerm = '';
        }, 1000);
    }
    
    /**
     * Handle clicks outside the dropdown
     */
    handleDocumentClick(event) {
        if (!this.container.contains(event.target)) {
            this.close();
        }
    }
    
    /**
     * Open the dropdown
     */
    open() {
        if (this.isOpen || this.container.hasAttribute('disabled')) {
            return;
        }
        
        this.isOpen = true;
        this.container.classList.add('open');
        this.container.setAttribute('aria-expanded', 'true');
        
        // Ensure menu is clickable
        this.menu.style.pointerEvents = 'auto';
        
        // Focus selected option or first option
        const focusIndex = this.selectedIndex >= 0 ? this.selectedIndex : 0;
        this.setFocusedOption(focusIndex);
        
        // Scroll to focused option
        this.scrollToOption(focusIndex);
        
        // Announce to screen readers
        this.announceToScreenReader('Options expanded');
    }
    
    /**
     * Close the dropdown
     */
    close() {
        if (!this.isOpen) {
            return;
        }
        
        this.isOpen = false;
        this.container.classList.remove('open');
        this.container.setAttribute('aria-expanded', 'false');
        this.clearFocusedOption();
        this.searchTerm = '';
        
        // Announce to screen readers
        this.announceToScreenReader('Options collapsed');
    }
    
    /**
     * Toggle dropdown open/close state
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * Select an option by index
     */
    selectOption(index) {
        if (index < 0 || index >= this.optionElements.length) {
            return;
        }
        
        const optionElement = this.optionElements[index];
        const value = optionElement.getAttribute('data-value');
        const text = optionElement.textContent;
        
        if (optionElement.classList.contains('disabled')) {
            return;
        }
        
        // Update visual state
        this.clearSelectedOption();
        this.selectedIndex = index;
        optionElement.classList.add('selected');
        optionElement.setAttribute('aria-selected', 'true');
        
        // Update trigger text
        this.triggerText.textContent = text;
        this.triggerText.classList.remove('placeholder');
        
        // Update original select
        this.originalSelect.value = value;
        
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        this.originalSelect.dispatchEvent(changeEvent);
        
        // Announce to screen readers
        this.announceToScreenReader(`Selected ${text}`);
    }
    
    /**
     * Clear current selection
     */
    clearSelectedOption() {
        if (this.selectedIndex >= 0) {
            const previousSelected = this.optionElements[this.selectedIndex];
            if (previousSelected) {
                previousSelected.classList.remove('selected');
                previousSelected.setAttribute('aria-selected', 'false');
            }
        }
        this.selectedIndex = -1;
    }
    
    /**
     * Set focused option for keyboard navigation
     */
    setFocusedOption(index) {
        this.clearFocusedOption();
        
        if (index >= 0 && index < this.optionElements.length) {
            this.focusedIndex = index;
            const option = this.optionElements[index];
            option.classList.add('focused');
            option.setAttribute('aria-focused', 'true');
            
            // Update aria-activedescendant
            this.container.setAttribute('aria-activedescendant', option.id || `option-${index}`);
        }
    }
    
    /**
     * Clear focused option
     */
    clearFocusedOption() {
        if (this.focusedIndex >= 0) {
            const option = this.optionElements[this.focusedIndex];
            if (option) {
                option.classList.remove('focused');
                option.removeAttribute('aria-focused');
            }
        }
        this.focusedIndex = -1;
        this.container.removeAttribute('aria-activedescendant');
    }
    
    /**
     * Focus next option in the list
     */
    focusNextOption() {
        let nextIndex = this.focusedIndex + 1;
        
        // Skip disabled options
        while (nextIndex < this.optionElements.length && 
               this.optionElements[nextIndex].classList.contains('disabled')) {
            nextIndex++;
        }
        
        if (nextIndex < this.optionElements.length) {
            this.setFocusedOption(nextIndex);
            this.scrollToOption(nextIndex);
        }
    }
    
    /**
     * Focus previous option in the list
     */
    focusPreviousOption() {
        let prevIndex = this.focusedIndex - 1;
        
        // Skip disabled options
        while (prevIndex >= 0 && 
               this.optionElements[prevIndex].classList.contains('disabled')) {
            prevIndex--;
        }
        
        if (prevIndex >= 0) {
            this.setFocusedOption(prevIndex);
            this.scrollToOption(prevIndex);
        }
    }
    
    /**
     * Focus first option
     */
    focusFirstOption() {
        let index = 0;
        while (index < this.optionElements.length && 
               this.optionElements[index].classList.contains('disabled')) {
            index++;
        }
        
        if (index < this.optionElements.length) {
            this.setFocusedOption(index);
            this.scrollToOption(index);
        }
    }
    
    /**
     * Focus last option
     */
    focusLastOption() {
        let index = this.optionElements.length - 1;
        while (index >= 0 && 
               this.optionElements[index].classList.contains('disabled')) {
            index--;
        }
        
        if (index >= 0) {
            this.setFocusedOption(index);
            this.scrollToOption(index);
        }
    }
    
    /**
     * Scroll to make option visible
     */
    scrollToOption(index) {
        if (index < 0 || index >= this.optionElements.length) {
            return;
        }
        
        const option = this.optionElements[index];
        const menu = this.menu;
        
        const optionTop = option.offsetTop;
        const optionBottom = optionTop + option.offsetHeight;
        const menuScrollTop = menu.scrollTop;
        const menuHeight = menu.offsetHeight;
        
        if (optionBottom > menuScrollTop + menuHeight) {
            menu.scrollTop = optionBottom - menuHeight;
        } else if (optionTop < menuScrollTop) {
            menu.scrollTop = optionTop;
        }
    }
    
    /**
     * Set initial value from original select
     */
    setInitialValue() {
        const selectedOption = this.originalSelect.querySelector('option[selected]');
        const value = selectedOption ? selectedOption.value : this.originalSelect.value;
        
        if (value) {
            const index = this.optionElements.findIndex(option => 
                option.getAttribute('data-value') === value
            );
            
            if (index >= 0) {
                this.selectOption(index);
            }
        } else {
            this.clearSelectedOption();
            this.triggerText.textContent = this.options.placeholder;
            this.triggerText.classList.add('placeholder');
        }
    }
    
    /**
     * Update selected option based on original select value
     */
    updateSelectedOption() {
        const value = this.originalSelect.value;
        
        if (value) {
            const index = this.optionElements.findIndex(option => 
                option.getAttribute('data-value') === value
            );
            
            if (index >= 0) {
                this.selectOption(index);
            }
        }
    }
    
    /**
     * Enable the dropdown
     */
    enable() {
        this.container.removeAttribute('disabled');
        this.trigger.disabled = false;
        this.originalSelect.disabled = false;
    }
    
    /**
     * Disable the dropdown
     */
    disable() {
        this.container.setAttribute('disabled', 'true');
        this.trigger.disabled = true;
        this.originalSelect.disabled = true;
        this.close();
    }
    
    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message) {
        // Create a temporary element for announcements
        if (!this.announcer) {
            this.announcer = document.createElement('div');
            this.announcer.setAttribute('aria-live', 'polite');
            this.announcer.setAttribute('aria-atomic', 'true');
            this.announcer.className = 'sr-only';
            document.body.appendChild(this.announcer);
        }
        
        this.announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            this.announcer.textContent = '';
        }, 1000);
    }
    
    /**
     * Destroy the dropdown and restore original select
     */
    destroy() {
        // Remove event listeners
        this.trigger.removeEventListener('click', this.handleTriggerClick);
        this.container.removeEventListener('keydown', this.handleKeydown);
        this.menu.removeEventListener('click', this.handleOptionClick);
        document.removeEventListener('click', this.handleDocumentClick);
        
        // Remove custom elements
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // Restore original select
        this.originalSelect.style.display = '';
        this.originalSelect.classList.remove('original-select');
        
        // Remove announcer
        if (this.announcer && this.announcer.parentNode) {
            this.announcer.parentNode.removeChild(this.announcer);
        }
    }
    
    /**
     * Get current value
     */
    getValue() {
        return this.originalSelect.value;
    }
    
    /**
     * Set value programmatically
     */
    setValue(value) {
        this.originalSelect.value = value;
        this.updateSelectedOption();
    }
    
    /**
     * Get current text
     */
    getText() {
        if (this.selectedIndex >= 0) {
            return this.optionElements[this.selectedIndex].textContent;
        }
        return '';
    }
    
    /**
     * Check if dropdown is disabled
     */
    isDisabled() {
        return this.container.hasAttribute('disabled');
    }
    
    /**
     * Refresh options from original select
     */
    refresh() {
        this.populateOptions();
        this.updateSelectedOption();
    }
}

/**
 * AUTO-INITIALIZATION
 * 
 * Automatically converts all select elements with 'custom-dropdown' class
 * when the DOM is ready.
 */

// Store dropdown instances for management
window.customDropdowns = window.customDropdowns || new Map();

/**
 * Initialize custom dropdown for a select element
 */
function initializeCustomDropdown(selectElement, options = {}) {
    if (!selectElement || selectElement.tagName !== 'SELECT') {
        console.warn('initializeCustomDropdown: Invalid select element provided');
        return null;
    }
    
    // Check if already initialized
    if (window.customDropdowns.has(selectElement)) {
        console.warn('initializeCustomDropdown: Dropdown already initialized for this element');
        return window.customDropdowns.get(selectElement);
    }
    
    try {
        // Create new dropdown instance
        const dropdown = new CustomDropdown(selectElement, options);
        window.customDropdowns.set(selectElement, dropdown);
        
        return dropdown;
    } catch (error) {
        return null;
    }
}

/**
 * Initialize dropdowns when DOM is ready
 */
function initializeDropdowns() {
    const selectElements = document.querySelectorAll('select.custom-dropdown, select[data-custom-dropdown]');
    
    selectElements.forEach(select => {
        // Extract options from data attributes
        const options = {};
        
        if (select.dataset.placeholder) {
            options.placeholder = select.dataset.placeholder;
        }
        
        if (select.dataset.searchable) {
            options.searchable = select.dataset.searchable === 'true';
        }
        
        if (select.dataset.maxHeight) {
            options.maxHeight = parseInt(select.dataset.maxHeight);
        }
        
        initializeCustomDropdown(select, options);
    });
}

/**
 * PUBLIC_INTERFACE
 * Enhanced category dropdown initialization specifically for new-workout form
 */
function initializeCategoryDropdown() {
    const categorySelect = document.getElementById('category_id');
    
    if (categorySelect) {
        return initializeCustomDropdown(categorySelect, {
            placeholder: 'Choose a category...',
            searchable: false,
            maxHeight: 250
        });
    }
    
    return null;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDropdowns);
} else {
    initializeDropdowns();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CustomDropdown, initializeCustomDropdown, initializeCategoryDropdown };
}

// Global access
window.CustomDropdown = CustomDropdown;
window.initializeCustomDropdown = initializeCustomDropdown;
window.initializeCategoryDropdown = initializeCategoryDropdown;
