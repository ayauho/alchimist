/**
 * @file utils/dom.js
 * @purpose DOM: Axiomatic BEM builders and minimalist node generation.
 */

export const dom = {
    /**
     * Minimalist element creation with attribute support.
     * @param {string} tag - HTML tag
     * @param {string} classes - Tailwind or BEM classes
     * @param {Object} props - Properties (innerText, innerHTML, onclick, etc.)
     */
    create(tag, classes = '', props = {}) {
        const el = document.createElement(tag);
        if (classes) el.className = classes;
        Object.entries(props).forEach(([key, val]) => {
            if (key === 'dataset') {
                Object.assign(el.dataset, val);
            } else {
                el[key] = val;
            }
        });
        return el;
    },

    /**
     * Waits for an element to appear in the DOM.
     * @param {string} selector - CSS selector to wait for
     * @param {number} timeout - Maximum wait time in milliseconds
     * @returns {Promise<HTMLElement|null>} Resolves with the element, or null if timed out
     */
    waitFor(selector, timeout = 3000) {
        return new Promise(resolve => {
            const existing = document.querySelector(selector);
            if (existing) return resolve(existing);

            const observer = new MutationObserver((mutations, obs) => {
                const el = document.querySelector(selector);
                if (el) {
                    obs.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }
};

