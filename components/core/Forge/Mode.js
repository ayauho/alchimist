/**
 * @file components/core/Forge/Mode.js
 * @purpose UI: Output Mode component for the Forge.
 */
import { Expander } from '../../reusable/Expander.js';
import { Selector } from '../../reusable/Selector.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';

const MODES = [
    { id: 'single', name: Language.text('MODE_SINGLE') },
    { id: 'matrix', name: Language.text('MODE_MATRIX') },
    { id: 'nexus', name: Language.text('MODE_NEXUS'), premiumLocked: true }
];

export class Mode {
    constructor(container) {
        this.container = container;
        this.activeId = 'single';

        this.handlePresetApplied = () => {
            Storage.get('mode').then(storedId => {
                if (storedId && MODES.some(m => m.id === storedId)) {
                    this.activeId = storedId;
                    if (this.selector) {
                        this.selector.activeId = storedId;
                        this.selector.refresh();
                    }
                    if (this.expander) this.expander.updateSubtitle(MODES.find(m => m.id === storedId).name);
                }
            });
        };
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);

        this.handleModeDisableList = (e) => {
            const ids = (e.detail && e.detail.disabledIds) || [];
            if (this.selector && typeof this.selector.setDisabledIds === 'function') {
                this.selector.setDisabledIds(ids);
            }
        };
        window.addEventListener('FORGE_MODE_DISABLE_LIST', this.handleModeDisableList);        

        // [ARTICLE] Listen for State.mode changes (e.g. Strategy.handleSelect forces 'single' when article is picked)
        this._unsubMode = State.subscribe('mode', (newMode) => {
            if (!newMode) return;
            const target = MODES.find(m => m.id === newMode);
            if (!target) return;
            if (this.activeId === newMode && this.selector && this.selector.activeId === newMode) return;
            this.activeId = newMode;
            if (this.selector) {
                this.selector.activeId = newMode;
                this.selector.refresh();
            }
            if (this.expander) this.expander.updateSubtitle(target.name);
            log('LOGIC', 'MODE_STATE_SUBSCRIBED_SYNC', { id: newMode });
        });
    }

    render() {
        this.selector = new Selector({
            items: MODES,
            activeId: this.activeId,
            onSelect: (item) => this.handleSelect(item)
        });

        this.expander = new Expander({
            title: Language.text('TITLE_MODE'),
            id: 'exp-mode',
            groupId: 'forge-inputs',
            isDominantConfig: true
        });

        this.expander = this.expander; // Explicitly expose to orchestrator
        const selectorNode = this.selector.render();
        const expanderNode = this.expander.render(selectorNode);
        
        this.container.appendChild(expanderNode);
        this.expander.updateSubtitle(MODES.find(m => m.id === this.activeId).name);

         // [ARTICLE] Self-heal: if Strategy was hydrated as 'article' BEFORE Mode mounted,
         // the FORGE_MODE_DISABLE_LIST event arrived without a live selector. Re-apply now.
         // [V14.5] Promo joins the same locked-mode set.
         const _lockedModeStrategy = State.get('interactionType');
         if ((_lockedModeStrategy === 'article' || _lockedModeStrategy === 'promo') && typeof this.selector.setDisabledIds === 'function') {
             this.selector.setDisabledIds(['matrix', 'nexus']);
             log('LOGIC', 'MODE_DISABLE_SELF_HEAL', { ids: ['matrix', 'nexus'], strategy: _lockedModeStrategy });
         }

        // Hydrate from Storage
        Storage.get('mode').then(storedId => {
            if (storedId && MODES.some(m => m.id === storedId)) {
                this.activeId = storedId;
                this.selector.activeId = storedId;
                this.selector.refresh();
                this.expander.updateSubtitle(MODES.find(m => m.id === storedId).name);
                State.set('mode', storedId);
            }
            window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
                detail: { key: 'active_mode_id', value: this.activeId } 
            }));
        });
    }

    async handleSelect(item, isReSelect) {
        // Integrity Gate: Reject posture keys
        if (item.id === 'alchemy' || item.id === 'repository') return;

        if (isReSelect) {
            this.expander.collapse();
            return;
        }

        this.activeId = item.id;
        this.expander.updateSubtitle(item.name);
        this.expander.collapse();
        
        // Dispatch for Global Registry Sync
        window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
            detail: { key: 'active_mode_id', value: item.id } 
        }));
        
        // Sovereign Mirror Sync
        State.set('mode', item.id);
        
        log('LOGIC', 'MODE_SYNC', { id: item.id });
    }

    destroy() {
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
         window.removeEventListener('FORGE_MODE_DISABLE_LIST', this.handleModeDisableList);
        if (this._unsubMode) this._unsubMode();
        if (this.expander && typeof this.expander.destroy === 'function') {
            this.expander.destroy();
        }
    }
}
