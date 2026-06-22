/**
 * @file components/reusable/ErrorCover.js
 * @purpose Specialized overlay for rendering AI failures via PrimeManifold.
 */
import { l } from '../../utils/logger.js';
import { ICONS } from '../../utils/assets.js';
import { PrimeManifold } from '../../modules/JsonPrime.js';
import { State } from '../../services/State.js';

export class ErrorCover {
    constructor() {
        this.overlay = null;
        this.manifoldHost = null;
        this._initDOM();
        this._setupListeners();
    }

    _initDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'c-error-cover u-hidden';
        
        this.overlay.innerHTML = `
            <div class="c-error-cover__top" title="Click to close"></div>
            <div class="c-error-cover__bottom">
                <div class="c-error-cover__close">
                    ${ICONS.CLOSE || '✕'}
                </div>
                <div class="c-error-cover__manifold-host"></div>
            </div>
        `;

        this.manifoldHost = this.overlay.querySelector('.c-error-cover__manifold-host');
        
        // Close interactions
        this.overlay.querySelector('.c-error-cover__top').onclick = () => this.hide();
        this.overlay.querySelector('.c-error-cover__close').onclick = () => this.hide();

        document.body.appendChild(this.overlay);
    }

    _setupListeners() {
        State.subscribe('is_error', (err) => {
            // [ABORT-SETTLE] An aborted AI request is a user-initiated settlement, not a failure.
            // Suppress abort-class values (hide only, never render). Domain validation keys on the
            // DOMException name first; the message fallback is narrow to avoid swallowing genuine
            // API errors that merely mention "abort".
            if (err && this._isAbort(err)) {
                l('[ERROR_COVER:ABORT_SUPPRESSED]', { name: err.name });
                this.overlay.classList.add('u-hidden');
                if (State.get('is_error')) State.set('is_error', false);
                return;
            }
            if (err) {
                this.show(err);
            } else {
                this.hide();
            }
        });
    }

    _isAbort(err) {
        if (err && err.name === 'AbortError') return true;
        const msg = (err && err.message) || (typeof err === 'string' ? err : '');
        return /^signal aborted|aborted without reason|the user aborted a request/i.test(msg);
    }

    /**
     * Recursive Unfolding: Deep-parses stringified JSON inside error objects.
     */
    _unfold(data) {
        if (typeof data !== 'string') return data;
        try {
            const parsed = JSON.parse(data);
            if (typeof parsed === 'object' && parsed !== null) {
                Object.keys(parsed).forEach(k => parsed[k] = this._unfold(parsed[k]));
                return parsed;
            }
            return data;
        } catch (err) {
            return data;
        }
    }

    show(rawError) {
        l('[ERROR_COVER:SHOW]', { rawError });
        
        const rawMessage = rawError?.message || rawError;
        let rootKey = "Error";
        let jsonPayload = rawMessage;

        if (typeof rawMessage === 'string') {
            const match = rawMessage.match(/^(.*?):\s*(\{.*\})$/s);
            if (match) {
                rootKey = match[1].trim();
                try {
                    jsonPayload = JSON.parse(match[2]);
                } catch (e) {
                    jsonPayload = match[2];
                }
            }
        }

        const finalData = { [rootKey]: this._unfold(jsonPayload) };

        // Clean up previous manifold
        this.manifoldHost.innerHTML = '';
        
        new PrimeManifold(this.manifoldHost, null, {
            initialData: finalData,
            readOnly: true,
            parse_string: true, // Enhanced parsing for AI responses
            hideViewControls: true // Hide the filter input + copy button in the error overlay
        });

        this.overlay.classList.remove('u-hidden');
    }

    hide() {
        if (this.overlay.classList.contains('u-hidden')) return;
        
        l('[ERROR_COVER:HIDE]');
        this.overlay.classList.add('u-hidden');
        State.set('is_error', false);
    }
}
