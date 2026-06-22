/**
 * @file components/reusable/Disclosure.js
 * @purpose Reusable primitive: 'Enhanced by Alchimist' attribution badge + one-click undo.
 *          Satisfies CWS visual-attribution + reversibility requirements for content modification.
 */
import { Language } from '../../services/Language.js';

const T = (token, fallback) => {
    const v = Language.text(token);
    return v === token ? fallback : v;
};

export const Disclosure = {
    badge() {
        const span = document.createElement('span');
        span.className = 'alchimist-disclosure__badge';
        span.textContent = T('DISCLOSURE_BADGE', 'Enhanced by Alchimist');
        return span;
    },

    /**
     * Attach attribution + undo next to a modified host node.
     * @param {HTMLElement} hostNode   element adjacent to the modified text
     * @param {string}      original   text to restore on undo
     * @param {Function}    restoreFn  receives `original`, applies the restore
     */
    attach(hostNode, original, restoreFn) {
        if (!hostNode) return;
        const badge = this.badge();
        const undo = document.createElement('button');
        undo.className = 'alchimist-disclosure__undo';
        undo.textContent = T('UNDO_RESTORE', 'Restore original');
        undo.addEventListener('click', () => {
            if (typeof restoreFn === 'function') restoreFn(original);
            badge.remove();
            undo.remove();
        });
        hostNode.appendChild(badge);
        hostNode.appendChild(undo);
    }
};

if (typeof window !== 'undefined') window.Disclosure = Disclosure;
