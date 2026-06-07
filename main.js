/**
 * 馬鹿工房 (UMA SHIKA KOBO) 
 * Main interaction script
 */

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');
    const siteLogo = document.getElementById('site-logo');

    // BGM Elements
    const modalOverlay = document.getElementById('music-announcement-overlay');
    const btnMusicOn = document.getElementById('btn-music-on');
    const btnMusicOff = document.getElementById('btn-music-off');
    const bgmToggleBtn = document.getElementById('sidebar-bgm-toggle');
    const bgmIcon = bgmToggleBtn?.querySelector('.bgm-icon');
    const bgmText = bgmToggleBtn?.querySelector('.bgm-text');

    let bgmAudio = null;
    let isBgmPlaying = false;
    let silenceTimeout = null;

    /**
     * Initialize the audio instance
     */
    function initBGM() {
        if (!bgmAudio) {
            bgmAudio = new Audio('うましかこうぼうのうた.mp3');
            bgmAudio.loop = false; // 3秒の無音時間を挟むため、標準のループは無効化

            // 曲が終了した際のイベントを設定
            bgmAudio.addEventListener('ended', () => {
                if (isBgmPlaying) {
                    silenceTimeout = setTimeout(() => {
                        if (isBgmPlaying) {
                            bgmAudio.play().catch(err => {
                                console.warn("BGM Replay failed:", err);
                            });
                        }
                    }, 3000); // 3秒（3000ms）待ってから再再生
                }
            });
        }
    }

    /**
     * Play BGM and update UI
     */
    function playBGM() {
        if (silenceTimeout) {
            clearTimeout(silenceTimeout);
            silenceTimeout = null;
        }
        initBGM();
        bgmAudio.play().then(() => {
            isBgmPlaying = true;
            updateBgmUI();
        }).catch(err => {
            console.warn("BGM Playback was prevented or failed:", err);
        });
    }

    /**
     * Pause BGM and update UI
     */
    function pauseBGM() {
        if (silenceTimeout) {
            clearTimeout(silenceTimeout);
            silenceTimeout = null;
        }
        if (bgmAudio) {
            bgmAudio.pause();
            isBgmPlaying = false;
            updateBgmUI();
        }
    }

    /**
     * Toggle BGM playback state
     */
    function toggleBGM() {
        if (isBgmPlaying) {
            pauseBGM();
        } else {
            playBGM();
        }
    }

    /**
     * Update BGM controls UI
     */
    function updateBgmUI() {
        if (!bgmToggleBtn || !bgmIcon || !bgmText) return;
        if (isBgmPlaying) {
            bgmToggleBtn.classList.add('playing');
            bgmIcon.textContent = '🔊';
            bgmText.textContent = 'BGM: ON';
        } else {
            bgmToggleBtn.classList.remove('playing');
            bgmIcon.textContent = '🔇';
            bgmText.textContent = 'BGM: OFF';
        }
    }

    // Show music announcement modal on startup
    if (modalOverlay) {
        // Force display
        modalOverlay.classList.add('active');
    }

    // Modal buttons listeners
    if (btnMusicOn && modalOverlay) {
        btnMusicOn.addEventListener('click', () => {
            playBGM();
            modalOverlay.classList.remove('active');
        });
    }

    if (btnMusicOff && modalOverlay) {
        btnMusicOff.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
        });
    }

    // Sidebar BGM button listener
    if (bgmToggleBtn) {
        bgmToggleBtn.addEventListener('click', () => {
            toggleBGM();
        });
    }

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
});