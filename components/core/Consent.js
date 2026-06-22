/**
 * @file components/core/Consent.js
 * @purpose Sovereign Global: onboarding consent gate for sending page/selected text to the external AI service.
 *          Consent flag persists via State._configKeys (text_analysis_consent). Sending to the AI is
 *          required for the extension to function — there is no local-only mode.
 */
import { State } from '../../services/State.js';
import { Language } from '../../services/Language.js';
import { log } from '../../utils/logger.js';

const T = (token, fallback) => {
    const v = Language.text(token);
    return v === token ? fallback : v;
};

export const Consent = {
    has(scope) {
        return State.get(`${scope}_consent`) === true;
    },

    grant(scope) {
        State.set(`${scope}_consent`, true);
        log('LOGIC', 'consent_gate_resolved', `granted:${scope}`);
    },

    revoke(scope) {
        State.set(`${scope}_consent`, false);
        log('LOGIC', 'consent_gate_resolved', `revoked:${scope}`);
    },

    /** First-run gate: prompt once until text_analysis consent is decided. */
    init() {
        if (this.has('text_analysis')) return;
        this.renderModal();
    },

    renderModal() {
        if (document.getElementById('alchimist-consent')) return;
        const wrap = document.createElement('div');
        wrap.id = 'alchimist-consent';
        wrap.className = 'c-modal';
        wrap.innerHTML = `
            <div class="c-modal__card">
                <h2 class="c-modal__header">${T('CONSENT_TITLE', 'How Alchimist handles your text')}</h2>
                <p class="c-modal__body">${T('CONSENT_BODY', 'To generate content, Alchimist structures the page content (and any text you select) and sends it to your configured AI service. This is required for the extension to work. Your own API key is used for every request; Alchimist keeps all data on your device.')}</p>
                <div class="c-modal__footer">
                    <a id="alchimist-consent-privacy" href="#" style="color:var(--text-secondary); font-size:12px; align-self:center; text-decoration:underline; cursor:pointer;">${T('CONSENT_PRIVACY', 'Privacy policy')}</a>
                    <button class="c-modal__btn--secondary" id="alchimist-consent-accept">${T('CONSENT_ACCEPT', 'I understand')}</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);

        wrap.querySelector('#alchimist-consent-privacy').addEventListener('click', (e) => {
            e.preventDefault();
            window.open(chrome.runtime.getURL('privacy.html'), '_blank');
        });
        wrap.querySelector('#alchimist-consent-accept').addEventListener('click', () => {
            this.grant('text_analysis');
            wrap.remove();
        });
    }
};

if (typeof window !== 'undefined') window.Consent = Consent;
