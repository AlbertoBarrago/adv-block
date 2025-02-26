chrome.storage.sync.get({pluginDisabled: false, whitelist: []}, (result) => {
    if (result.pluginDisabled) {
        return;
    }

    const currentHostname = window.location.hostname;
    if (result.whitelist && result.whitelist.includes(currentHostname)) {
        return;
    }

    const sensitiveHosts = ['youtube.com', 'www.youtube.com'];
    if (sensitiveHosts.some(host => currentHostname.includes(host))) {
        const youtubeSpecificRules = `
            .video-ads,
            .ytp-ad-overlay-container,
            .ytd-display-ad-renderer,
            .ytd-companion-slot-renderer {
                display: none !important;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.textContent = youtubeSpecificRules;
        document.documentElement.appendChild(styleSheet);
        return;
    }

    (function () {
        const styleBannerRules = `
            .banner:not([class*="player"]):not([class*="video"]),
            .banner-ad,
            .sticky-banner,

            div[class*="ad-"]:not([class*="player"]):not([class*="video"]),
            div[class*="-ad"]:not([class*="player"]):not([class*="video"]),
            div[class*="advert"]:not([class*="player"]):not([class*="video"]),

            div[class*="sponsor"],
            div[class*="promotion"]:not([class*="video"]),

            div[id*="ad-"]:not([id*="player"]):not([id*="video"]),
            div[id*="advert"]:not([id*="player"]):not([id*="video"]),

            div[id^="google_ads"],
            div[class^="google_ad"] {
                display: none !important;
            }
            div[class*="banner-adv"] {
                display: none !important;
            }
    `;

        const styleSheet = document.createElement("style");
        styleSheet.textContent = styleBannerRules;
        document.documentElement.appendChild(styleSheet);

        const blockedAds = new Set();

        /**
         * Updates the extension badge with the current count of blocked advertisements
         * @param {number} count - The total number of blocked advertisements
         * @returns {void}
         */
        const updateBadgeCount = (count) => {
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                    action: "updateBadge",
                    count: count,
                    hostname: window.location.hostname
                });
            }
        }

        /**
         * Identifies and removes advertisement elements from the DOM
         * Tracks unique advertisements and updates the badge count
         * @returns {void}
         */
        const removeAds = () => {
            const adSelectors = `
            [id*="google_ads"],
            iframe[id*="google_ads_iframe"],
            [id*="div-gpt-ad"],
            [id^="gpt"],
        
            [id*="advert"],
            [id*="adunit"],
            [id*="adbox"],
            [id*="__lxG__bsticky_lx_728768"],
        
            [class*="ads"]:not([class*="player"]):not([class*="video"]):not([class*="form"]),
            [class*="advertisement"],
            [class*="sponsored"]:not([class*="player"]):not([class*="video"]):not([class*="form"]),
            [class*="adsbox"],
            [class*="adsbygoogle"],
            [class*="ad-slot"],
            [class*="adbox"],
            .adv,
            .adv-box,
        
            iframe[src*="doubleclick.net"],
            iframe[src*="ad."],
        
            [data-ad-client]
        `;

            const adElements = document.querySelectorAll(adSelectors);

            adElements.forEach(ad => {
                if (ad && (ad.id || ad.className)) {
                    const identifier = ad.id || ad.className;
                    if (!blockedAds.has(identifier)) {
                        blockedAds.add(identifier);
                        updateBadgeCount(blockedAds.size);
                    }
                    requestAnimationFrame(() => ad.remove());
                }
            });
        }

        /**
         * Initializes the MutationObserver to monitor DOM changes for new advertisements
         * Ensures the document.body is available before starting observation
         * @returns {void}
         */
        const initObserver = () => {
            if (!document.body) {
                const observer = new MutationObserver(() => {
                    if (document.body) {
                        observer.disconnect();
                        initObserver();
                    }
                });
                observer.observe(document.documentElement, {childList: true});
                return;
            }

            const mutationObserver = new MutationObserver(() => removeAds());
            mutationObserver.observe(document.body, {childList: true, subtree: true});

            removeAds();
        }

        document.addEventListener("DOMContentLoaded", initObserver);
        initObserver();

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "getBlockedAds") {
                sendResponse({
                    blockedAds: Array.from(blockedAds)
                });
            }
        });
    })();
});