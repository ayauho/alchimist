/**
 * @file components/core/Forge/Strategy.js
 * @purpose UI: Interaction Strategy component for the Forge.
 */
import { Expander } from '../../reusable/Expander.js';
import { Selector } from '../../reusable/Selector.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';

const ARTICLE_ALLOWED_PROTOCOLS = [
    'void_source_auditor',
    'engagement_kinetics',
    'thematic_tagging',
    'emoji_enhancement', 'kaomoji_enhancement', 'boldify_enhancement',
    'image_prompt_addon',
    'signature',
    'detailed_suggestions'
];

// [V14.5] Promo allowed protocols = all except cognitive_origin_auditor and social_alchemy.
// Defined as a deny-list so additions to PROTOCOL_CONFIG over time automatically remain available.
const PROMO_FORBIDDEN_PROTOCOLS = ['cognitive_origin_auditor', 'social_alchemy'];

function _hasProfile() {
    const prof = State.get('profile_intelligence');
    return !!(prof && typeof prof === 'object' && Object.keys(prof).length > 0);
}

const STRATEGIES = [
   { id: 'rewrite', name: 'Rewrite / Post' },
   { id: 'comment', name: 'Comment / Thread Reply' },
   { id: 'reaction', name: 'Present / Quote Post' },   
   { id: 'article', name: 'Long-form Article', premiumLocked: true },
   { id: 'promo', name: 'Promotional Post' }
];

export class Strategy {
    constructor(container) {
        this.container = container;
        this.activeId = 'rewrite';

        this.handlePresetApplied = () => {
             // [V13] applyPreset() calls State.set('interactionType') synchronously before
             // dispatching PRESET_APPLIED, so State is the authoritative source here.
             // Previously used Storage.get (async) which races with the write buffer and
             // omitted the mode/protocol cascade, leaving Matrix+Nexus permanently disabled
             // after switching away from an 'article' preset.
             const storedId = State.get('interactionType');
             if (storedId && STRATEGIES.some(s => s.id === storedId)) {
                 this.activeId = storedId;
                 if (this.selector) {
                     this.selector.activeId = storedId;
                     this.selector.refresh();
                 }
                 if (this.expander) this.expander.updateSubtitle(STRATEGIES.find(s => s.id === storedId).name);
                 // [V13] Re-fire the disable cascade on every preset switch so Mode re-enables
                 // Matrix/Nexus when leaving the 'article' strategy. Mirrors handleSelect exactly.
                 if (storedId === 'article') {
                     window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: ['matrix', 'nexus'] } }));
                     window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: ARTICLE_ALLOWED_PROTOCOLS } }));
                 } else if (storedId === 'promo') {
                     // [V14.5] Promo cascade — same shape as article: lock mode, restrict protocols.
                     window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: ['matrix', 'nexus'] } }));
                     window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: this._promoAllowedList() } }));
                 } else {
                     window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: [] } }));
                     window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: null } }));
                 }
             }
        };
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);

        // [V14.5] Reactively gate the 'promo' option on profile presence.
        this._unsubProfile = State.subscribe('profile_intelligence', () => this._refreshPromoGate());
    }

    _promoAllowedList() {
        // Lazy-import via global module cache — PROTOCOL_CONFIG is exported from Protocols.js but
        // importing it here creates a circular reference, so derive from the union of known keys
        // that Protocols.js maintains. Falls back to a fixed allow-list mirror of the deny-list.
        // Read PROTOCOL keys from State subscriptions registered by Protocols.js if available.
        // Safe baseline: enumerate keys known at compile time, minus the forbidden two.
        const ALL = [
            'void_source_auditor', 'resonance_buffer', 'causal_anchor', 'entropy_shield',
            'nexus_sync', 'image_prompt_addon', 'signature', 'detailed_suggestions',
            'cognitive_origin_auditor', 'twitter_short', 'engagement_kinetics',
            'social_alchemy', 'thematic_tagging', 'emoji_enhancement',
            'kaomoji_enhancement', 'boldify_enhancement'
        ];
        return ALL.filter(k => !PROMO_FORBIDDEN_PROTOCOLS.includes(k));
    }

    _refreshPromoGate() {
        const hasProfile = _hasProfile();
        if (this.selector && typeof this.selector.setDisabledIds === 'function') {
            this.selector.setDisabledIds(hasProfile ? [] : ['promo']);
        }
        // Auto-revert: if promo became invalid mid-session, swing to 'rewrite' and persist.
        if (!hasProfile && this.activeId === 'promo') {
            log('LOGIC', 'PROMO_GATE_AUTO_REVERT', { reason: 'profile_cleared' });
            const target = STRATEGIES.find(s => s.id === 'rewrite');
            this.activeId = 'rewrite';
            if (this.selector) { this.selector.activeId = 'rewrite'; this.selector.refresh(); }
            if (this.expander) this.expander.updateSubtitle(target.name);
            State.set('interactionType', 'rewrite');
            Storage.set({ interactionType: 'rewrite' });
            window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST',  { detail: { disabledIds: [] } }));
            window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: null } }));
        }
    }

    render() {
        const content = document.createElement('div');
        
        this.selector = new Selector({
            items: STRATEGIES,
            activeId: this.activeId,
            onSelect: (item) => this.handleSelect(item)
        });

        this.expander = new Expander({
            title: Language.text('TITLE_STRATEGY'),
            id: 'exp-strategy',
            groupId: 'forge-inputs',
            isDominantConfig: true
        });

        this.expander = this.expander; // Explicitly expose to orchestrator
        const selectorNode = this.selector.render();
        const expanderNode = this.expander.render(selectorNode);
        
        this.container.appendChild(expanderNode);
        this.expander.updateSubtitle(STRATEGIES.find(s => s.id === this.activeId).name);

        // [V14.5] Apply initial gate BEFORE hydration so the disabled state is visible from frame 0.
        this._refreshPromoGate();

        // Hydrate from Storage
        Storage.get('interactionType').then(storedId => {
            if (storedId && STRATEGIES.some(s => s.id === storedId)) {
                // [V14.5] If hydrated value is 'promo' but no profile exists, revert before mount visibility.
                if (storedId === 'promo' && !_hasProfile()) {
                    log('LOGIC', 'PROMO_HYDRATION_REVERT', { reason: 'no_profile_at_hydration' });
                    storedId = 'rewrite';
                    State.set('interactionType', 'rewrite');
                    Storage.set({ interactionType: 'rewrite' });
                }
                this.activeId = storedId;
                this.selector.activeId = storedId;
                this.selector.refresh();
                this.expander.updateSubtitle(STRATEGIES.find(s => s.id === storedId).name);
                State.set('interactionType', storedId);
                 // [ARTICLE] Re-apply disable cascade for persisted 'article' strategy on cold-start / Forge re-mount.
                 // Without this, matrix/nexus and disallowed protocols stay clickable until the user re-selects Strategy.
                 if (storedId === 'article') {
                     window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: ['matrix', 'nexus'] } }));
                     window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: ARTICLE_ALLOWED_PROTOCOLS } }));
                     log('LOGIC', 'ARTICLE_HYDRATION_CASCADE_DISPATCHED', { storedId });
                 } else if (storedId === 'promo') {
                     window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: ['matrix', 'nexus'] } }));
                     window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: this._promoAllowedList() } }));
                     log('LOGIC', 'PROMO_HYDRATION_CASCADE_DISPATCHED', { storedId });
                 } else {
                     window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: [] } }));
                     window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: null } }));
                 }
            }
            window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
                detail: { key: 'active_strategy_id', value: this.activeId } 
            }));
            // [V14.5] Re-gate after hydration race (profile may have hydrated after Storage.get('interactionType')).
            this._refreshPromoGate();
        });
    }

    async handleSelect(item, isReSelect) {
        if (isReSelect) {
            this.expander.collapse();
            return;
        }

        this.activeId = item.id;
        this.expander.updateSubtitle(item.name);
        this.expander.collapse();
       
        // Dispatch for Global Registry Sync
        window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
            detail: { key: 'active_strategy_id', value: item.id } 
        }));
       
        // Sovereign Mirror Sync
        State.set('interactionType', item.id);
        // CRITICAL CONVERGENCE: Force linear identifiability by unconditionally writing interactionType
        Storage.set({ interactionType: item.id });
       
         // [ARTICLE] Stage-driven disable cascade
         if (item.id === 'article') {
             State.set('mode', 'single');
             Storage.set({ mode: 'single' });
             window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: ['matrix', 'nexus'] } }));
             window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: ARTICLE_ALLOWED_PROTOCOLS } }));
             log('LOGIC', 'ARTICLE_MODE_LOCK', { mode: 'single' });
         } else if (item.id === 'promo') {
             // [V14.5] Promo cascade — mode locked to single, deny COA + Social Alchemy.
             State.set('mode', 'single');
             Storage.set({ mode: 'single' });
             window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: ['matrix', 'nexus'] } }));
             window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: this._promoAllowedList() } }));
             log('LOGIC', 'PROMO_MODE_LOCK', { mode: 'single' });
         } else {
             window.dispatchEvent(new CustomEvent('FORGE_MODE_DISABLE_LIST', { detail: { disabledIds: [] } }));
             window.dispatchEvent(new CustomEvent('FORGE_PROTOCOLS_RESTRICT', { detail: { allowed: null } }));
         }

        log('LOGIC', 'STRATEGY_SYNC', { id: item.id });
    }

    destroy() {
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
        if (this._unsubProfile) this._unsubProfile();
        if (this.expander && typeof this.expander.destroy === 'function') {
            this.expander.destroy();
        }
    }
}
