import { l } from '../../utils/logger.js';
import { ANIMATIONS, ICONS, HARVEST_ANIMATIONS } from '../../utils/assets.js';
import { Language } from '../../services/Language.js';
import { State } from '../../services/State.js';
import { dom } from '../../utils/dom.js';
import { Logger } from '../../utils/logger.js';

/**
 * @class Waiting
 * @purpose Manages the alchemical "Waiting Cover" overlay.
 * Monitors state flags and displays priority-based animations and captions.
 * Includes lifecycle cleanup to prevent state leaks.
 */
export class Waiting {
    constructor(container) {
        this.container = container;
        this.overlay = null;
        this.captionNode = null;
        this.loaderNode = null;
        
        // Operation Priority Matrix (Highest number = Highest priority)
        this.priority = {
            INTEGRATING_TREASURY: 12,
            RECALIBRATING: 10,
            HARVESTING_DATA: 9,
            FORGING: 8,
            IMPROVING_PROMPT: 7,
            MUTATING: 6,
            CROSSBREEDING: 6,
            SYNTHESIZING: 5,
            // [V17] Article attribute auto-completion — slotted with IMPROVING_PROMPT tier (7);
            // decoupled from is_transmuting so the global Footer gateway is never disabled by it.
            COMPLETING_ARTICLE: 7,
            // [V14] Metric Alchemy — same priority as Persona counterparts so a concurrently
            // running Metric op does not visually downgrade a Persona op (and vice versa).
            MUTATING_METRIC: 6,
            CROSSBREEDING_METRIC: 6,
            SYNTHESIZING_METRIC: 5,
            SUGGESTING: 4,
            INCREASING_LENGTH: 4,
            DECREASING_LENGTH: 4,            
            TRANSMUTING: 3,
            INCREASING_VALUE: 11,
            DECREASING_VALUE: 11
        };
        
        this.activeType = null;
        this._wasTransmuting = false; // [V13.S³] Trailing-edge tracker for cleanup
        this.cancelTimer = null;
        this.cancelBtn = null;
        this._initDOM();
        this._setupListeners();

        // [V13.E-RECOVERY] Terminal "Kill-All" state listener
        State.subscribe('is_error', (err) => {
            if (err) this.hide();
        });
    }

    /**
     * [V13.S³] Setup listeners for Sovereign State flags.
     * Delegates to _checkAllStates to manage priority and lifecycle.
     */
    _setupListeners() {
        const stateKeys = [
            'is_transmuting',
            'is_synthesizing',
            'is_mutating',
            'is_crossbreeding',
            'is_improving_prompt',
            'is_suggesting',
            'is_recalibrating',
            'is_forging',
            'is_completing_article',
            'is_increasing_length',
            'is_decreasing_length',
            'is_harvesting_profile',
            // [V14] Metric Alchemy waiting flags
            'is_synthesizing_metric',
            'is_mutating_metric',
            'is_crossbreeding_metric',
            'is_increasing_value',
            'is_decreasing_value',
            'is_integrating_treasury'
        ];

        stateKeys.forEach(key => {
            State.subscribe(key, () => this._checkAllStates());
        });
    }

    /**
     * [V13.S³] Central Logic Manifold
     * 1. Detects end of transmutation to clear transient intent flags.
     * 2. Resolves the highest priority active state to display.
     */
    _checkAllStates() {
        const states = {
            is_transmuting: 'TRANSMUTING',
            is_synthesizing: 'SYNTHESIZING',
            is_mutating: 'MUTATING',
            is_crossbreeding: 'CROSSBREEDING',
            is_improving_prompt: 'IMPROVING_PROMPT',
            is_suggesting: 'SUGGESTING',
            is_recalibrating: 'RECALIBRATING',
            is_forging: 'FORGING',
            is_completing_article: 'COMPLETING_ARTICLE',
            is_increasing_length: 'INCREASING_LENGTH',
            is_decreasing_length: 'DECREASING_LENGTH',
            is_harvesting_profile: 'HARVESTING_DATA',
            // [V14] Metric Alchemy state-flag → animation-type mapping
            is_synthesizing_metric: 'SYNTHESIZING_METRIC',
            is_mutating_metric: 'MUTATING_METRIC',
            is_crossbreeding_metric: 'CROSSBREEDING_METRIC',
            is_increasing_value: 'INCREASING_VALUE',
            is_decreasing_value: 'DECREASING_VALUE',
            is_integrating_treasury: 'INTEGRATING_TREASURY'
        };

        const isTransmuting = State.get('is_transmuting');

        // [V13.S³] State Cleanup: If transmutation just ended, purge transient trigger flags
        if (!isTransmuting && this._wasTransmuting) {
            State.update({
                is_increasing_length: false,
                is_decreasing_length: false,
                is_suggesting: false,
                is_improving_prompt: false
            });
        }
        this._wasTransmuting = isTransmuting;

        let highestType = null;
        let maxPriority = -1;

        // Find the active state with the highest priority
        Object.entries(states).forEach(([key, type]) => {
            if (State.get(key)) {
                const p = this.priority[type] || 0;
                if (p > maxPriority) {
                    maxPriority = p;
                    highestType = type;
                }
            }
        });

        if (highestType) {
            this.show(highestType);
        } else {
            this.hide();
        }
    }

    /**
     * Initializes the overlay DOM structure and appends it to the document.
     */
    _initDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'c-waiting-overlay u-hidden';
        
        this.loaderNode = document.createElement('div');
        this.loaderNode.className = 'c-waiting-overlay__loader';
        
        this.captionNode = document.createElement('div');
        this.captionNode.className = 'c-waiting-overlay__caption waiting-caption';
        
        this.overlay.appendChild(this.loaderNode);
        this.overlay.appendChild(this.captionNode);
        
        document.body.appendChild(this.overlay);
    }

    /**
     * Retrieves a random animation for the specified type based on the active UI theme.
     */
    _getRandomAnimation(type) {
        if (type === 'HARVESTING_DATA') {
            const keys = Object.keys(HARVEST_ANIMATIONS);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            return HARVEST_ANIMATIONS[randomKey];
        }

        try {
            const currentTheme = State.get('ui_theme') || 'MINIMALIST';
            const themeAnimations = ANIMATIONS[currentTheme] || ANIMATIONS['MINIMALIST'];
            
            let typeAnimations = themeAnimations ? (themeAnimations[type] || themeAnimations[type.replace('ING', 'ION')]) : null;
            
            if (typeAnimations) {
                if (typeof typeAnimations === 'string') {
                    return this._stripStyleTagsFromSVG(typeAnimations);
                }
                if (Array.isArray(typeAnimations) && typeAnimations.length > 0) {
                    const randomIndex = Math.floor(Math.random() * typeAnimations.length);
                    return this._stripStyleTagsFromSVG(typeAnimations[randomIndex]);
                }
            }
        } catch(e) {
            l('e', 'ANIM_ERROR', { type, error: e.message });
        }
        
        // Ultimate Fallback: Route to main ICONS if theme-specific animations are missing
        const fallbackMap = { 'TRANSMUTING': 'ALCHEMY_SYNTH', 'SYNTHESIZING': 'ALCHEMY_SYNTH', 'FORGING': 'ALCHEMY_MUTATE' };
        const iconKey = fallbackMap[type] || type;
        
        if (typeof ICONS !== 'undefined' && ICONS[iconKey]) {
            return ICONS[iconKey];
        }

        return '⏳';
    }

    /**
     * Removes potentially conflicting style tags from SVG strings.
     */
    _stripStyleTagsFromSVG(svgString) {
        return svgString.replace(/<style>[\s\S]*?<\/style>/gi, '');
    }

    /**
     * Activates the waiting cover. Respects priority to prevent downgrading visuals.
     */
    show(type = 'TRANSMUTING') {
        // Double-check priority if show is called directly from elsewhere
        const currentPriority = this.priority[this.activeType] || 0;
        const incomingPriority = this.priority[type] || 0;

        if (this.activeType && incomingPriority < currentPriority) {
            l('[WAITING_DOWNGRADE_PREVENTED]', { current: this.activeType, rejected: type });
            return; 
        }
        
        if (this.activeType === type && !this.overlay.classList.contains('u-hidden')) return;

        this.activeType = type;
        
        const animation = this._getRandomAnimation(type);
        const caption = Language.text(`WAITING_${type}`);

        l('[WAITING_START]', { type, animationSelected: !!animation });
        
        this.loaderNode.innerHTML = animation;
        this.captionNode.innerText = caption;
        this.overlay.classList.remove('u-hidden');
        
        clearTimeout(this.cancelTimer);
        this.cancelTimer = setTimeout(() => this._renderCancelButton(), 60000);
    }

    /**
     * Hides the waiting cover with a double RAF to ensure smooth transitions.
     */
    hide() {
        if (!this.activeType) return;
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.overlay) {
                    this.overlay.classList.add('u-hidden');
                    this.activeType = null;
                    clearTimeout(this.cancelTimer);
                    if (this.cancelBtn) {
                        this.cancelBtn.remove();
                        this.cancelBtn = null;
                    }
                    l('[WAITING_END]');
                }
            });
        });
    }

    _renderCancelButton() {
        if (this.cancelBtn) return;
        this.cancelBtn = dom.create('button', 'btn-cancel-waiting text-white border border-white font-bold px-4 py-2 rounded shadow-lg absolute bottom-8 z-50 transition-all hover:scale-105 active:scale-95', {
            textContent: Language.text('BTN_CANCEL')
        });
        this.cancelBtn.onclick = () => {
            l('[UI] User clicked Cancel during wait');
            
            // Unified Interruption Signal
            window.dispatchEvent(new CustomEvent('INTERRUPT_ALCHIMIST_VOID'));
            
            // Global State Reset to unlock UI
            const loadingFlags = [
                'is_transmuting', 'is_synthesizing', 'is_mutating', 
                'is_crossbreeding', 'is_refining', 'is_improving_prompt',
                'is_increasing_value', 'is_decreasing_value'
            ];
            loadingFlags.forEach(flag => {
                if (State.get(flag)) State.set(flag, false);
            });

            this.hide();
            Logger.userLog('LOG_WARN_WAITING_CANCELLED', 'warning');
        };
        this.overlay.appendChild(this.cancelBtn);
    }
}