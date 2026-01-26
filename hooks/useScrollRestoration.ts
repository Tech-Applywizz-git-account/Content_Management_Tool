import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const getScrollKey = (pathname: string) => `scroll_position_${pathname}`;

/**
 * Custom hook to preserve and restore scroll position using SessionStorage.
 * Handles both window scroll and main container scroll (for Layout.tsx).
 * Includes robust polling for async content loading.
 */
export const useScrollRestoration = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null); // Kept to prevent HMR hook order mismatch
    const hasRestoredRef = useRef(false);

    // Restore scroll position when component mounts (or path changes)
    useEffect(() => {
        // Reset restoration flag when path changes
        hasRestoredRef.current = false;

        const key = getScrollKey(location.pathname);
        const savedScroll = sessionStorage.getItem(key);

        // If no saved position, we don't need to do anything
        if (!savedScroll) return;

        const targetScrollY = parseInt(savedScroll, 10);
        if (isNaN(targetScrollY)) return;

        // Polling mechanism to attempt scroll restoration
        let attempts = 0;
        const maxAttempts = 100; // ~1.5 seconds at 60fps

        const attemptScroll = () => {
            // Stop if we've successfully restored in this cycle
            // (Note: we use a local check or allow multiple successes in case layout shifts)
            // But usually once matched is enough.

            let scrolled = false;

            // 1. Try window scroll
            // Only effective if window is scrollable
            if (document.documentElement.scrollHeight > window.innerHeight) {
                window.scrollTo({
                    top: targetScrollY,
                    behavior: 'instant' as ScrollBehavior
                });

                // Success check
                if (Math.abs(window.scrollY - targetScrollY) < 20) {
                    scrolled = true;
                }
            }

            // 2. Try main container scroll (for Layout.tsx)
            const mainContainer = document.querySelector('main');
            if (mainContainer) {
                mainContainer.scrollTop = targetScrollY;

                // Success check
                if (Math.abs(mainContainer.scrollTop - targetScrollY) < 20 ||
                    // Or if we reached the bottom (content shorter than saved scroll)
                    (mainContainer.scrollHeight - mainContainer.clientHeight > 0 &&
                        mainContainer.scrollTop + mainContainer.clientHeight >= mainContainer.scrollHeight - 5)) {
                    scrolled = true;
                }
            }

            if (scrolled) {
                hasRestoredRef.current = true;
                return; // Success!
            }

            if (attempts >= maxAttempts) {
                // Timeout
                return;
            }

            attempts++;
            requestAnimationFrame(attemptScroll);
        };

        // Start polling
        attemptScroll();

        // Backup timeout force check
        const timeoutId = setTimeout(() => {
            attempts = 0;
            attemptScroll();
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [location.pathname]);

    /**
     * Save current scroll position to SessionStorage
     */
    const saveScrollPosition = () => {
        let scrollY = window.scrollY;

        // Check main container
        const mainContainer = document.querySelector('main');
        if (mainContainer && mainContainer.scrollTop > 0) {
            scrollY = mainContainer.scrollTop;
        }

        const key = getScrollKey(location.pathname);
        sessionStorage.setItem(key, scrollY.toString());
        return scrollY;
    };

    /**
     * Navigate to a new route while saving the current page's scroll position
     */
    const navigateWithScroll = (path: string, additionalState?: any) => {
        saveScrollPosition();
        navigate(path, { state: additionalState });
    };

    /**
     * Navigate back
     */
    const navigateBack = () => {
        // We don't necessarily save scroll here, just go back.
        // The previous page should handle its own restoration via session storage.
        navigate(-1);
    };

    return {
        saveScrollPosition,
        navigateWithScroll,
        navigateBack,
        scrollContainerRef
    };
};
