/**
 * 馬鹿工房 (UMA SHIKA KOBO) 
 * Main interaction script
 */

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');
    const siteLogo = document.getElementById('site-logo');

    /**
     * Function to switch between content views
     * @param {string} pageId - ID of the page to show
     */
    function switchView(pageId) {
        // Update navigation visual state
        navItems.forEach(item => {
            const isTarget = item.getAttribute('data-page') === pageId;
            item.classList.toggle('active', isTarget);
        });

        // Update content visibility with smooth transition
        pageViews.forEach(view => {
            const isTarget = view.id === `page-${pageId}`;
            view.classList.toggle('active', isTarget);
        });

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Bind click events to navigation items
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.getAttribute('data-page');
            switchView(targetPage);
        });
    });

    // Logo click returns to Home
    if (siteLogo) {
        siteLogo.addEventListener('click', () => {
            switchView('home');
        });
    }
});
