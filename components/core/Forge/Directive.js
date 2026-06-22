import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';

export class Directive {
    constructor(parent) {
        this.parent = parent;
        this.storageKey = 'alchimist_directive_history';
        this.selectedIndex = -1;
        this.filteredHistory = [];
        this.isDominant = false;
        this.isForgeActive = true;
        
        this.reconcile = this.reconcile.bind(this);
        this.handleSuccess = this.handleSuccess.bind(this);
        this.handleStateChange = this.handleStateChange.bind(this);
        this.handleTabSwitch = this.handleTabSwitch.bind(this);
        this.handlePersonaChange = this.handlePersonaChange.bind(this);
    }

    async render() {
        this.citadel = dom.create('div', 'flex flex-col w-full', { id: 'forge-directive-citadel' });
        this.historyBox = dom.create('div', 'w-full bg-[#121214] border-b border-[#27272a] shadow-inner u-hidden custom-scrollbar', { id: 'directive-history-container' });
        
        this.input = dom.create('textarea', 'w-full bg-[#1a1a1d] text-white p-3 text-sm outline-none resize-none block custom-scrollbar', {
            id: 'directive-input',
            placeholder: Language.text('PLACEHOLDER_DIRECTIVE')
        });

         // [V13.S³] HYDRATION RACE DEFENSE — DO NOT REVERT.
         // State.resetVolatile() (app.js:366) fires on every TAB_SWITCH and re-hydrates
         // the in-memory state map directly from raw Storage. Storage uses buffered writes
         // (see STORAGE_BUFFER_UPDATED), so the empty value committed by handleSuccess()
         // may not have flushed when resetVolatile() reads it back, causing the in-memory
         // 'directive' to be silently resurrected to its pre-transmute value. The
         // resurrection bypasses State.set() and is invisible to console.trace.
         // Directive is ephemeral by design (see handlePersonaChange Ephemeral Guard), so
         // starting empty is the correct semantic. The handleStateChange subscription
         // below catches any legitimate post-mount State updates.
         this.input.value = '';
         State.set('directive','')
        
        this.input.addEventListener('input', (e) => {
            const val = e.target.value;
            State.set('directive', val);
            this.filterHistory(val);
            this.adjustHeight();
        });

        this.input.addEventListener('focus', () => this.filterHistory(this.input.value));

         // [V13] Click-to-toggle on an already-focused input. The first click on an unfocused textarea
         // makes the browser focus it AFTER our mousedown handler runs, so document.activeElement is
         // still the previously-focused element at this point — we early-return and let the existing
         // 'focus' listener open the history. A second mousedown with the input already focused
         // toggles history visibility, giving the user a click-driven counterpart to ESC/Backspace.
         this.input.addEventListener('mousedown', () => {
             if (document.activeElement !== this.input) return;
             const isVisible = !this.historyBox.classList.contains('u-hidden');
             if (isVisible) {
                 this.historyBox.classList.add('u-hidden');
                 this.selectedIndex = -1;
                 this.reconcile();
             } else {
                 this.filterHistory(this.input.value);
             }
         });

        this.input.addEventListener('blur', () => {
            setTimeout(() => {
                this.historyBox.classList.add('u-hidden');
                this.reconcile();
            }, 200);
        });

        this.unsubDirective = State.subscribe('directive', this.handleStateChange);
        this.unsubPersona = State.subscribe('active_persona', this.handlePersonaChange);

        this.citadel.append(this.historyBox, this.input);
        
        this.wrapper = dom.create('div', 'directive-wrapper');
        this.wrapper.append(this.citadel);
        this.parent.append(this.wrapper);

        this.setupListeners();
        this.reconcile();
    }

    getDirective() {
        return this.input.value.trim();
    }

    getValue() {
        return this.getDirective();
    }

    handleStateChange(value) {
        const safeValue = value || '';
        if (this.input.value !== safeValue) {
            const start = this.input.selectionStart;
            const end = this.input.selectionEnd;
            this.input.value = safeValue;
            
            // Restore cursor position if it was active to prevent "jumping"
            if (document.activeElement === this.input) {
                this.input.setSelectionRange(start, end);
            }
            this.reconcile();
        }
    }

    adjustHeight() {
        this.input.style.height = 'auto';
        this.input.style.height = this.input.scrollHeight + 'px';
    }

    setupListeners() {
        // [V13.S³] Terminal Flush on Success
        window.addEventListener('TRANSMUTATION_SUCCESS', this.handleSuccess);

        // [V13.S³] Bind Citadel to Viewport Dominance
        document.addEventListener('UI_DOMINANCE_CHANGE', (event) => {
            const data = event.detail || event;
            
            const FORGE_DOMAIN = ['exp-persona', 'exp-strategy', 'exp-mode', 'exp-protocols'];
            if (data.id && !FORGE_DOMAIN.includes(data.id)) return;

            this.isDominant = data.isDominant;
            if (data.isDominant) {
                this.occlude(data.source);
            } else {
                this.restore();
            }
        });

        this.unsubManaging = State.subscribe('is_managing_personas', (isActive) => {
            this.isManaging = isActive;
            if (isActive) {
                this.occlude('management');
            } else {
                this.restore();
            }
        });

        this.input.addEventListener('keydown', (e) => this.handleKeys(e));

        document.addEventListener('mousedown', (e) => {
            if (!this.citadel.contains(e.target)) {
                this.historyBox.classList.add('u-hidden');
                this.reconcile();
            }
        });

        window.addEventListener('TAB_SWITCH', this.handleTabSwitch, true);
    }

    async filterHistory(query) {
        await this.updateHistoryUI();
    }

    async updateHistoryUI() {
        const allHistory = await Storage.get(this.storageKey) || [];
        const val = this.input.value.toLowerCase();

        this.filteredHistory = allHistory.filter(item => {
            const matches = item.toLowerCase().includes(val);
            return matches && item !== this.input.value;
        });

        if (this.filteredHistory.length === 0) {
            this.historyBox.classList.add('u-hidden');
            this.reconcile();
            return;
        }

        this.historyBox.innerHTML = '';
        this.filteredHistory.forEach((item, idx) => {
            const baseClasses = 'p-2 px-4 cursor-pointer hover:bg-[#27272a] text-xs text-[#a1a1aa] flex items-center border-b border-[#1f1f22] last:border-0';
            const activeClass = idx === this.selectedIndex ? ' bg-[#27272a]' : '';
            
            const el = dom.create('div', baseClasses + activeClass, {
                'data-index': idx
            });

            const label = dom.create('span', 'truncate w-full block', { title: item });
            label.textContent = item;
            
            el.appendChild(label);
            el.onclick = () => this.select(idx);
            this.historyBox.append(el);
        });

        this.historyBox.classList.remove('u-hidden');
        
        this.reconcile();
        
        if (this.selectedIndex === -1) {
            this.historyBox.scrollTop = this.historyBox.scrollHeight;
        } else {
            const active = this.historyBox.children[this.selectedIndex];
            if (active) active.scrollIntoView({ block: 'nearest' });
        }
    }

    handleKeys(e) {
        const isHistoryVisible = !this.historyBox.classList.contains('u-hidden') && this.historyBox.style.display !== 'none';

         // [V13] ESC: close the history box if visible AND blur the input regardless. This gives the
         // user a single keystroke that unconditionally exits both the suggestion UI and the input
         // focus, so the next keystroke is interpreted by the surrounding shell, not by this textarea.
         if (e.key === 'Escape') {
             if (isHistoryVisible) {
                 e.preventDefault();
                 this.historyBox.classList.add('u-hidden');
                 this.selectedIndex = -1;
                 this.reconcile();
             }
             this.input.blur();
             return;
         }

         // [V13] Backspace on an empty input while history is visible: close the history. Default
         // backspace is a no-op on a zero-length textarea, so preventDefault here has no side effects
         // on text editing — it only short-circuits the history dismissal. When the input has any
         // content, this branch is skipped and backspace behaves normally (deleting a character).
         if (e.key === 'Backspace' && isHistoryVisible && this.input.value.length === 0) {
             e.preventDefault();
             this.historyBox.classList.add('u-hidden');
             this.selectedIndex = -1;
             this.reconcile();
             return;
         }

        if (isHistoryVisible) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = this.selectedIndex <= 0 ? this.filteredHistory.length - 1 : this.selectedIndex - 1;
                this.updateHistoryUI();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = this.selectedIndex >= this.filteredHistory.length - 1 ? 0 : this.selectedIndex + 1;
                this.updateHistoryUI();
            } else if (e.key === 'Enter' && !e.shiftKey && this.selectedIndex !== -1) {
                e.preventDefault();
                this.select(this.selectedIndex);
            }
        }

        if (e.key === 'Enter' && e.shiftKey) {
            // Transmutation signal simulation
            this.input.blur();
        }
    }

    select(idx) {
        this.input.value = this.filteredHistory[idx];
        this.historyBox.classList.add('u-hidden');
        this.selectedIndex = -1;
        this.reconcile();
        this.input.focus();
        State.set('directive', this.input.value);
    }

    handlePersonaChange() {
        // [V13.S³] Ephemeral Directive Guard
        // Clear the directive field when switching personas/presets 
        // to prevent "sticky" instructions from leaking across contexts.
        if (State.get('directive')) {
            log('LOGIC', 'EPHEMERAL_GUARD', 'Clearing directive due to context switch.');
            State.set('directive', '');
            if (this.input) this.input.value = '';
            this.reconcile();
        }
    }

    async handleSuccess() {
        const directiveTxt = State.get('directive');
       
        if (directiveTxt) {
            // [V13.S³] Immediate Sync Clear: Wipe state and DOM before any async work
            // to prevent Forge re-renders from reading stale directive during history save awaits.
            State.set('directive', '');
            State.set('active_intent', '');
            if (this.input) this.input.value = '';
            Storage.remove('alchimist_directive_buffer');
            if (this.historyBox) this.historyBox.classList.add('u-hidden');
            this.reconcile();
            if (typeof log === 'function') log('UI', 'DIRECTIVE_CLEARANCE', 'Directive cleared and saved to history.');
            if (typeof log === 'function') log('LOGIC', ['INTENT_CONSUMED'], 'Directive transmuted, clearing buffer');
            // [V13.S³] History Persistence: Save to buffer after wiping (non-blocking)
            let history = await Storage.get(this.storageKey) || [];
            history = history.filter(item => item !== directiveTxt);
            history.push(directiveTxt);
            await Storage.set({ [this.storageKey]: history });
        } else {
            State.set('directive', '');
            State.set('active_intent', '');
            if (this.input) this.input.value = '';
            Storage.remove('alchimist_directive_buffer');
            if (this.historyBox) this.historyBox.classList.add('u-hidden');
            this.reconcile();
        }
    }

    reconcile() {
        if (this.wrapper && this.wrapper.classList.contains('u-hidden')) return;
        
        const isHistoryVisible = !this.historyBox.classList.contains('u-hidden');
        const vhLimit = window.innerHeight * (2 / 3);
        
        // 1. Textarea Auto-growth with 2/3 VH limit
        this.input.style.height = '0px';
        const scrollH = this.input.scrollHeight;
        
        if (scrollH > vhLimit) {
            this.input.style.height = vhLimit + 'px';
            this.input.style.overflowY = 'auto';
        } else {
            this.input.style.height = Math.max(48, scrollH) + 'px';
            this.input.style.overflowY = 'hidden';
        }

        // 2. History Box Height & Scroll logic
        if (isHistoryVisible) {
            this.historyBox.style.height = ''; // Ensure no inline height overrides CSS constraints
        }

        // Trigger parent to adjust scroll-wrapper bounds
        window.dispatchEvent(new Event('resize'));
    }

    occlude(source = 'unknown') {
        this.wrapper.classList.add('u-hidden');
        const token = Language.text('LOG_CITADEL_OCCLUDED') || 'Citadel yielded to {source}';
        if (typeof log === 'function') log('UI', ['FORGE', 'VISIBILITY'], token.replace('{source}', source));
    }

    handleTabSwitch(e) {
        const target = e.detail?.target || e.detail?.id;
        if (!target) return;
        this.isForgeActive = (target === 'Forge');
        if (!this.isForgeActive) this.occlude('tab_switch');
        else this.restore();
    }

    restore() {
        if (this.isDominant || !this.isForgeActive) return;
        this.wrapper.classList.remove('u-hidden');
        // [V13.S³] Defensive Sync: Re-read authoritative State on restore to kill any stale DOM value
        const currentDirective = State.get('directive') || '';
        if (this.input && this.input.value !== currentDirective) {
            this.input.value = currentDirective;
            this.adjustHeight();
        }
        if (typeof log === 'function') log('UI', ['FORGE', 'VISIBILITY'], Language.text('LOG_CITADEL_RESTORED') || 'Citadel restored to substrate');
        this.reconcile();
    }

    destroy() {
        window.removeEventListener('TRANSMUTATION_SUCCESS', this.handleSuccess);
        window.removeEventListener('TAB_SWITCH', this.handleTabSwitch);
        if (this.unsubDirective) this.unsubDirective();
        if (this.unsubPersona) this.unsubPersona();
        if (this.unsubManaging) this.unsubManaging();
        window.removeEventListener('TAB_SWITCH', this.handleTabSwitch, true);
    }
}