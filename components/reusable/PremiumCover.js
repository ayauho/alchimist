/**
 * @file components/reusable/PremiumCover.js
 * @purpose Full-viewport premium ("⚗ Unseal") buy overlay. Genetic mirror of ErrorCover's
 *          skeleton (top click-zone + top-right X). Summoned by the global 'PREMIUM_GATE_OPEN'
 *          event dispatched by any gated host. The buy CTA is intentionally INERT (logs only)
 *          until a vendor URL is wired (Q3).
 * @standard Transient overlay stacking arbitration — elevation derived from co-present overlays.
 */
import { ICONS } from '../../utils/assets.js';
import { Language } from '../../services/Language.js';
import { log } from '../../utils/logger.js';
import { STORE_URL, PREMIUM_FEATURE_TOKENS } from '../../utils/constants.js';

const T = (token, fallback) => Language.text(token) || fallback;

export class PremiumCover {
    constructor() {
        this.overlay = null;
        this._onGateOpen = (e) => this.show(e && e.detail ? e.detail : {});
        this._initDOM();
        window.addEventListener('PREMIUM_GATE_OPEN', this._onGateOpen);
    }

    _initDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'c-premium-cover u-hidden flex flex-col';
        // Sovereign inline criticals (permitted for transient overlays): paintable + dominant
        // even before any styles.css theme patch lands. A later batch can lift these into themes.
        this.overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(5,5,7,0.94);backdrop-filter:blur(4px);';

        const featuresHtml = PREMIUM_FEATURE_TOKENS
            .map(([token, fallback]) => `<li>${T(token, fallback)}</li>`)
            .join('');

        this.overlay.innerHTML = `
            <div class="c-premium-cover__top" title="Click to close" style="flex:1;cursor:pointer;"></div>
            <div class="c-premium-cover__panel" style="position:relative;max-width:520px;width:92%;margin:0 auto 12vh;padding:28px 24px;background:#0a0a0a;border:1px solid rgba(212,175,55,0.35);border-radius:12px;box-shadow:0 0 40px rgba(212,175,55,0.12);">
                <div class="c-premium-cover__close" title="Close" style="position:absolute;top:10px;right:12px;cursor:pointer;font-size:18px;color:#a1a1aa;line-height:1;">${ICONS.CLOSE || '✕'}</div>
                <div style="font-size:20px;font-weight:800;letter-spacing:0.02em;color:#d4af37;margin-bottom:12px;">${T('TITLE_PREMIUM_OVERLAY', 'Sovereign Tier')}</div>
                <ul class="c-premium-cover__features">${featuresHtml}</ul>
                <button class="c-premium-cover__buy" data-action="premium:buy" style="width:100%;padding:12px 16px;font-size:14px;font-weight:700;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border:none;border-radius:8px;cursor:pointer;">${T('BTN_BUY_PREMIUM', 'Transmute to Sovereign — $25')}</button>
                <div style="font-size:10px;line-height:1.5;color:#71717a;margin-top:12px;text-align:center;">${T('MSG_PREMIUM_DELIVERY', 'After purchase, your license key arrives by email within 24 hours.')}</div>
            </div>
        `;

        this.overlay.querySelector('.c-premium-cover__top').onclick = () => this.hide();
        this.overlay.querySelector('.c-premium-cover__close').onclick = () => this.hide();
        this.overlay.querySelector('.c-premium-cover__buy').onclick = () => this.onBuy();

        document.body.appendChild(this.overlay);
    }

    // Dominate every co-present overlay rather than trust a fixed z-index.
    _elevate() {
        let max = 9999;
        document.querySelectorAll('.c-error-cover, .waiting-cover, [data-overlay]').forEach(el => {
            if (el === this.overlay) return;
            const z = parseInt(getComputedStyle(el).zIndex, 10);
            if (!Number.isNaN(z) && z > max) max = z;
        });
        this.overlay.style.setProperty('z-index', String(max + 1), 'important');
    }

    show(detail = {}) {
        this._elevate();
        this.overlay.classList.remove('u-hidden');
        log('UI', 'PREMIUM_COVER_SHOWN', { actionId: detail.actionId || null });
    }

    hide() {
        if (this.overlay.classList.contains('u-hidden')) return;
        this.overlay.classList.add('u-hidden');
    }

    // Egress: open the vendor store page in a new tab. Buy is an action, not an
    // entitlement gate — navigation is unconditional (gate-duality N/A).
    onBuy() {
        log('UI', 'PREMIUM_BUY_CLICKED', { url: STORE_URL });
        window.open(STORE_URL, '_blank', 'noopener');
        log('UI', 'PREMIUM_BUY_NAVIGATED', { url: STORE_URL });
    }

    destroy() {
        window.removeEventListener('PREMIUM_GATE_OPEN', this._onGateOpen);
        if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
    }
}
