/**
 * @file components/core/Features/Integrations.js
 * @purpose UI: Orchestrator for Intelligence Integrations (Chars, Archetypes, Schemes).
 * @standard High-fidelity identity harvesting with Scheme Dominance and Flicker-Free Temporal Sync.
 */
import { Expander } from '../../reusable/Expander.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { State } from '../../../services/State.js';
import { Char } from './Char.js';
import { Archetype } from './Archetype.js';
import { Scheme } from './Scheme.js';
import { log } from '../../../utils/logger.js';

export class Integrations {
    constructor() {
        /**
         * [V13.S³] Boot Lock
         * Suppresses reactive UI updates during initial hydration to prevent boot-time flickering.
         */
        this._isBooting = true;
        this._syncTimer = null;

        this.container = dom.create('div', 'integrations-wrapper w-full mt-4 min-w-0');
        
        // Instantiate child feature modules
        this.chars = new Char();
        this.archetypes = new Archetype();
        this.schemes = new Scheme([this.chars, this.archetypes]);

        // Main orchestrator expander
        this.expander = new Expander({
            id: 'exp-integrations',
            title: Language.text('TITLE_INTEGRATIONS') || 'Integrations',
            isDominantConfig: true,
            groupId: 'features-main',
            onToggle: (isExpanded) => {
                State.set('is_integrations_open', isExpanded);
            }
        });

        /**
         * Global synchronization callback.
         * [V13.S³] Temporal Alignment Protocol: 
         * Debounced at 120ms to allow the Scheme Consistency Engine (100ms) 
         * to settle before drawing indicators, preventing reactive flickering.
         */
        const syncAll = () => {
            if (this._isBooting) return;
            
            clearTimeout(this._syncTimer);
            this._syncTimer = setTimeout(() => {
                this.updateFeatureIndicator(this.chars, 'outline');
                this.updateFeatureIndicator(this.archetypes, 'outline');
                this.updateFeatureIndicator(this.schemes, 'filled');
                this.updateMainIndicator();
            }, 120);
        };

        // Reactive Subscription Matrix
        this.unsubCharCount = State.subscribe('chars_active_count', syncAll);
        this.unsubArchCount = State.subscribe('archetypes_active_count', syncAll);
        this.unsubSchemeCount = State.subscribe('schemes_active_count', syncAll);
        this.unsubActiveScheme = State.subscribe('active_scheme_id', syncAll);
    }

    /**
     * Internal helper to extract the appropriate abbreviation strings for a feature instance.
     * @param {Object} instance - The feature manager instance.
     * @returns {string[]} Array of abbreviation strings.
     * @private
     */
    _getAbbrevs(instance) {
        if (!instance || !instance.items) return [];
        
        let activeItems;
        // Chars/Archs evaluate against local isActive, Schemes against global State ID
        if (instance.id === 'scheme') {
            const activeId = State.get('active_scheme_id');
            activeItems = instance.items.filter(i => i.id === activeId);
        } else {
            activeItems = instance.items.filter(i => i.isActive);
        }
        
        return activeItems.map(item => {
            const name = item.name || "";
            const parts = name.trim().split(/\s+/);
            
            if (instance.id === 'char' || instance.id === 'scheme') {
                return parts[0] || "";
            }
            
            if (instance.id === 'archetype') {
                if (parts.length <= 1) return parts[0] || "";
                const first = parts[0];
                const secondLetter = parts[1] ? parts[1][0] : "";
                return `${first} ${secondLetter}.`;
            }
            
            return parts[0] || "";
        }).filter(Boolean);
    }

    /**
     * Updates indicators for a specific sub-expander header.
     */
    updateFeatureIndicator(instance, mode) {
        const abbrevs = this._getAbbrevs(instance);
        this.updateIndicator(instance.expander, abbrevs, mode, instance.id);
    }

    /**
     * Low-level indicator pusher. Construct badge objects for the Expander component.
     */
    updateIndicator(expander, texts, mode = 'outline', type = null) {
        if (!expander) return;
        
        const indicators = Array.isArray(texts) ? texts.map(text => {
            // [V13.S³] Special Inversion for Character Indicators: White BG, Black Text (Geometric Seal)
            if (type === 'char') {
                return {
                    abbrev: text,
                    color: 'transparent',
                    cssText: 'background-color: #fff !important; color: #000 !important; padding: 1px 4px; font-size: 9px; line-height: 9px; font-family: "JetBrains Mono", monospace; text-transform: uppercase; border-radius: 2px; border: none; display: block;'
                };
            }

            return {
                abbrev: text,
                color: 'var(--text-primary)',
                cssText: mode === 'outline' 
                    ? 'border: 1px solid var(--text-secondary); background: rgba(255,255,255,0.05);' 
                    : 'background: var(--accent); border: none;'
            };
        }) : [];
        
        if (typeof expander.updateIndicators === 'function') {
            expander.updateIndicators(indicators);
        }
    }

    /**
     * Updates the main Integrations expander header.
     * Implements "Scheme Dominance": If a scheme is active, it eclipses individual unit badges.
     */
    updateMainIndicator() {
        const activeSchemeId = State.get('active_scheme_id');
        const schemesList = State.get('schemes') || [];
        const activeScheme = activeSchemeId ? schemesList.find(s => s.id === activeSchemeId) : null;

        // Dominance Mode: Show ONLY the active scheme name
        if (activeScheme) {
            const indicators = [{
                abbrev: activeScheme.name,
                color: 'var(--text-primary)',
                cssText: 'background: var(--accent); border: none;'
            }];
            if (this.expander && typeof this.expander.updateIndicators === 'function') {
                this.expander.updateIndicators(indicators);
            }
            return;
        }

        // Individual Mode: Aggregate granular badges
        const charAbbrevs = this._getAbbrevs(this.chars).map(text => ({
            abbrev: text,
            color: 'transparent',
            cssText: 'background-color: #fff !important; color: #000 !important; padding: 1px 4px; font-size: 9px; line-height: 9px; font-family: "JetBrains Mono", monospace; text-transform: uppercase; border-radius: 2px; border: none; display: block;'
        }));

        const otherAbbrevs = this._getAbbrevs(this.archetypes).map(text => ({
            abbrev: text,
            color: 'var(--text-primary)',
            cssText: 'border: 1px solid var(--text-secondary); background: rgba(255,255,255,0.05);'
        }));

        const indicators = [...charAbbrevs, ...otherAbbrevs];

        if (this.expander && typeof this.expander.updateIndicators === 'function') {
            this.expander.updateIndicators(indicators);
        }
    }

    render() {
        const content = dom.create('div', 'flex flex-col space-y-1');
        
        // Mount Chars
        const charContainer = dom.create('div', 'integration-list w-full', { id: 'char-list' });
        this.chars.listContainer = charContainer;
        content.appendChild(this.chars.expander.render(charContainer));
        
        // Mount Archetypes
        const archContainer = dom.create('div', 'integration-list w-full', { id: 'arch-list' });
        this.archetypes.listContainer = archContainer;
        content.appendChild(this.archetypes.expander.render(archContainer));
        
        // Mount Schemes
        const schemeContainer = dom.create('div', 'integration-list w-full', { id: 'scheme-list' });
        this.schemes.listContainer = schemeContainer;
        content.appendChild(this.schemes.expander.render(schemeContainer));

        // [V13.S³] Sequential Initialization: 
        // 1. Hydrate units -> 2. Initialize Schemes (Consistency Engine) -> 3. Release Boot Lock
        Promise.all([
            this.chars.init(),
            this.archetypes.init()
        ]).then(() => {
            return (typeof this.schemes.initialize === 'function') ? this.schemes.initialize() : this.schemes.init();
        }).then(() => {
            this._isBooting = false;
            
            // Execute final stable update immediately upon settlement
            clearTimeout(this._syncTimer);
            this.updateFeatureIndicator(this.chars, 'outline');
            this.updateFeatureIndicator(this.archetypes, 'outline');
            this.updateFeatureIndicator(this.schemes, 'filled');
            this.updateMainIndicator();
            
            log('LOGIC', 'INTEGRATIONS_LIFECYCLE_SETTLED', { active_scheme: State.get('active_scheme_id') });
        });

        this.container.appendChild(this.expander.render(content));
        return this.container;
    }

    destroy() {
        this.chars.destroy();
        this.archetypes.destroy();
        this.schemes.destroy();
        if (this.unsubCharCount) this.unsubCharCount();
        if (this.unsubArchCount) this.unsubArchCount();
        if (this.unsubSchemeCount) this.unsubSchemeCount();
        if (this.unsubActiveScheme) this.unsubActiveScheme();
        if (this.expander) this.expander.destroy();
        clearTimeout(this._syncTimer);
    }
}