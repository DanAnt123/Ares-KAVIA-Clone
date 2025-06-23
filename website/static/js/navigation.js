/**
 * Modern Navigation System
 * Handles mobile menu toggle, smooth interactions, and accessibility
 */

// PUBLIC_INTERFACE
class NavigationManager {
    /**
     * Initialize the navigation system with modern functionality
     */
    constructor() {
        this.navbar = document.querySelector('.modern-navbar');
        this.navToggle = document.getElementById('nav-toggle');
        this.navToggleLabel = document.querySelector('.nav-toggle-label');
        this.navOverlay = document.querySelector('.nav-overlay');
        this.navMenu = document.querySelector('.navbar-menu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.isMenuOpen = false;
        
        this.init();
    }

    // PUBLIC_INTERFACE
    init() {
        /**
         * Initialize all navigation functionality
         */
        this.setupMobileNavigation();
        this.setupScrollBehavior();
        this.setupActiveStates();
        this.setupAccessibility();
        this.setupKeyboardNavigation();
    }

    // PUBLIC_INTERFACE
    setupMobileNavigation() {
        /**
         * Setup mobile hamburger menu functionality
         */
        if (this.navToggle && this.navOverlay) {
            // Toggle menu on hamburger click
            this.navToggle.addEventListener('change', () => {
                this.isMenuOpen = this.navToggle.checked;
                this.toggleMobileMenu();
            });

            // Close menu when clicking overlay
            this.navOverlay.addEventListener('click', () => {
                this.closeMobileMenu();
            });

            // Close menu when clicking navigation links
            this.navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        this.closeMobileMenu();
                    }
                });
            });
        }
    }

    // PUBLIC_INTERFACE
    setupScrollBehavior() {
        /**
         * Add scroll-based navbar effects
         */
        let lastScrollY = window.scrollY;
        let ticking = false;

        const updateNavbar = () => {
            const currentScrollY = window.scrollY;
            
            // Add scrolled class for styling
            if (currentScrollY > 10) {
                this.navbar?.classList.add('navbar-scrolled');
            } else {
                this.navbar?.classList.remove('navbar-scrolled');
            }

            // Hide/show navbar on scroll (optional)
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                this.navbar?.classList.add('navbar-hidden');
            } else {
                this.navbar?.classList.remove('navbar-hidden');
            }
            
            lastScrollY = currentScrollY;
            ticking = false;
        };

        const requestTick = () => {
            if (!ticking) {
                requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        };

        window.addEventListener('scroll', requestTick, { passive: true });
    }

    // PUBLIC_INTERFACE
    setupActiveStates() {
        /**
         * Highlight active navigation items based on current page
         */
        const currentPath = window.location.pathname;
        
        this.navLinks.forEach(link => {
            const linkPath = new URL(link.href).pathname;
            
            // Remove existing active class
            link.classList.remove('active');
            
            // Add active class to current page link
            if (linkPath === currentPath || 
                (currentPath === '/' && linkPath === '/') ||
                (currentPath.startsWith('/workout') && linkPath === '/workout') ||
                (currentPath.startsWith('/new-workout') && linkPath === '/new-workout')) {
                link.classList.add('active');
            }
        });
    }

    // PUBLIC_INTERFACE
    setupAccessibility() {
        /**
         * Enhance accessibility for screen readers and keyboard users
         */
        // Add ARIA attributes
        if (this.navToggle) {
            this.navToggle.setAttribute('aria-expanded', 'false');
            this.navToggle.setAttribute('aria-controls', 'navbar-menu');
        }

        if (this.navMenu) {
            this.navMenu.setAttribute('id', 'navbar-menu');
        }

        // Update ARIA states when menu toggles
        const updateAriaStates = () => {
            if (this.navToggle) {
                this.navToggle.setAttribute('aria-expanded', this.isMenuOpen.toString());
            }
        };

        // Listen for menu state changes
        if (this.navToggle) {
            this.navToggle.addEventListener('change', updateAriaStates);
        }
    }

    // PUBLIC_INTERFACE
    setupKeyboardNavigation() {
        /**
         * Handle keyboard navigation for accessibility
         */
        // Close mobile menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen) {
                this.closeMobileMenu();
            }
        });

        // Focus management for mobile menu
        if (this.navMenu) {
            this.navMenu.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    this.handleTabNavigation(e);
                }
            });
        }
    }

    // PUBLIC_INTERFACE
    toggleMobileMenu() {
        /**
         * Toggle the mobile navigation menu
         */
        if (this.isMenuOpen) {
            this.openMobileMenu();
        } else {
            this.closeMobileMenu();
        }
    }

    // PUBLIC_INTERFACE
    openMobileMenu() {
        /**
         * Open the mobile navigation menu
         */
        document.body.classList.add('nav-menu-open');
        this.navbar?.classList.add('menu-open');
        
        // Focus first nav link for accessibility
        setTimeout(() => {
            const firstLink = this.navMenu?.querySelector('.nav-link');
            firstLink?.focus();
        }, 300);
    }

    // PUBLIC_INTERFACE
    closeMobileMenu() {
        /**
         * Close the mobile navigation menu
         */
        this.isMenuOpen = false;
        if (this.navToggle) {
            this.navToggle.checked = false;
        }
        
        document.body.classList.remove('nav-menu-open');
        this.navbar?.classList.remove('menu-open');
        
        // Return focus to toggle button
        this.navToggleLabel?.focus();
    }

    // PUBLIC_INTERFACE
    handleTabNavigation(e) {
        /**
         * Handle tab navigation within mobile menu
         */
        if (!this.isMenuOpen) return;

        const focusableElements = this.navMenu?.querySelectorAll(
            'a[href], button, [tabindex]:not([tabindex="-1"])'
        );
        
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NavigationManager();
});

// Handle resize events
window.addEventListener('resize', () => {
    // Close mobile menu on resize to desktop
    if (window.innerWidth > 768) {
        const navToggle = document.getElementById('nav-toggle');
        if (navToggle?.checked) {
            navToggle.checked = false;
            document.body.classList.remove('nav-menu-open');
        }
    }
});

// Smooth scroll for anchor links (if any)
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link) {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
});
