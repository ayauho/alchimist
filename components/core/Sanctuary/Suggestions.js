/**
 * @file components/core/Sanctuary/Suggestions.js
 * @purpose Pure UI generation and Payload assembly for Refinements
 */
import { dom } from '../../../utils/dom.js';
import { log } from '../../../utils/logger.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { Language } from '../../../services/Language.js';

export const Suggestions = {
    render(suggestions, recordId, targetIdx = 0, directive = '') {
        if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
            return dom.create('div', 'hidden');
        }

        const wrapper = dom.create('div', 'suggestions-wrapper mt-2');
        const row = dom.create('div', 'suggestions-row flex gap-2 w-full');
        
        suggestions.forEach(sug => {
            const btn = dom.create('button', 'suggestion-btn', {
                innerText: sug,
                onclick: (e) => this.handleSuggestionClick(e.target, sug, recordId, targetIdx, directive)
            });
            row.appendChild(btn);
        });

        wrapper.appendChild(row);
        return wrapper;
    },

    _watchdogActive: false,
    _activeBtn: null,
    _activeText: '',

    _startWatchdog() {
        if (this._watchdogActive) return;
        this._watchdogActive = true;

        const resetBtn = () => {
            if (this._activeBtn && document.body.contains(this._activeBtn)) {
                this._activeBtn.innerHTML = this._activeText;
                this._activeBtn.disabled = false;
                log('UI', 'SUGGESTION_BTN_RESTORED');
            }
            State.set('is_suggesting', false);
            this._activeBtn = null;
        };

        State.subscribe('is_error', (err) => {
            if (err) resetBtn();
        });

        window.addEventListener('alchimist:render-complete', resetBtn);
        log('UI', 'SUGGESTION_WATCHDOG_INIT');
    },

    async handleSuggestionClick(btn, suggestionText, recordId, targetIdx, directive = '') {
        this._startWatchdog();
        
        this._activeBtn = btn;
        this._activeText = btn.innerHTML;
        
        btn.innerHTML = `<span class="animate-pulse">${Language.text('UI_REFINING')}</span>`;
        btn.disabled = true;

        try {
            State.set('is_suggesting', true);
            log('UI', 'SUGGESTION_CLICK', { suggestion: suggestionText, id: recordId });
            window.dispatchEvent(new CustomEvent('REFINEMENT_REQUEST', { 
                detail: { suggestion: suggestionText, originalId: recordId, targetIdx, directive } 
            }));
        } catch (err) {
            log('e', 'REFINEMENT_ERROR', err.message);
            State.set('is_suggesting', false);
            State.set('is_error', err);
        }
    }
};