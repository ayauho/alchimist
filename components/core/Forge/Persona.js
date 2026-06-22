/**
 * @file components/core/Forge/Persona.js
 * @purpose UI: Identity Manifold component for the Forge.
 */
import { Tag as TagComponent, TagColorizer } from '../../reusable/Tag.js';
import { Expander } from '../../reusable/Expander.js';
import { Selector } from '../../reusable/Selector.js';
import { Item } from '../../reusable/Item.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { Tabs } from '../../reusable/Tabs.js';
import { Alchemy } from '../Alchemy.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { ICONS, DEFAULT_PERSONAS } from '../../../utils/assets.js';
import { Editor } from '../../reusable/Editor.js';
import Dropdown from '../../reusable/Dropdown.js';
import { PersonaCategories } from './Persona/Categories.js';

export class Persona {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;

        this.isolationKey = options.isolationKey || null;
        this.noManage = options.noManagePersonas || false;
        this.isSilent = options.isSilent || false;
        this.show_all = options.show_all || false;
        this.sharedPrefs = options.sharedPrefs || null; // Hoisted preferences support
        this.activeTab = options.noManagePersonas ? 'select_only' : 'select';

        this.keys = {
            activeId: this.isolationKey ? `persona_active_id_${this.isolationKey}` : 'personas_active_id',
            activeTab: this.isolationKey ? `persona_active_tab_${this.isolationKey}` : 'persona_active_tab',
            sortPrefs: this.isolationKey ? `persona_sort_prefs_${this.isolationKey}` : 'persona_sorting_prefs',
            tagSortPrefs: this.isolationKey ? `persona_tag_sorting_prefs_${this.isolationKey}` : 'persona_tag_sorting_prefs',
            tagViewState: this.isolationKey ? `persona_tag_view_state_${this.isolationKey}` : 'persona_tag_view_state'
        };
        
        this.handlePresetApplied = async () => {
            const storedId = await Storage.get(this.keys.activeId);
            if (storedId) {
                this.activeId = storedId;
                const personas = await Storage.get('personas') || [];
                const p = personas.find(x => x.id === storedId);
                if (p && this.expander) this.expander.updateSubtitle(this._subtitleLabel(p));
                if (typeof this.refreshPersonaList === 'function') this.refreshPersonaList();
            }
        };
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);

        this.isDestroyed = false;
        this.hasBeenMounted = false;

        // [V13.FIX] Signal Interceptor: Catch the global 'Create' request
        this._onGlobalCreate = () => { if (this.isOrphaned()) return; this.handleCreate(); };
        window.addEventListener('CREATE_PERSONA_CLICKED', this._onGlobalCreate);

        log('UI', 'PERSONA_CONSTRUCT', { id: options.id || 'exp-persona', isolationKey: this.isolationKey });
        this.activeId = options.activeId || (options.allowNone ? 'none' : 'deep-tech-researcher');
        this.items = DEFAULT_PERSONAS; // Fallback to assets if storage is hollow

        this.isManagementMode = false;
        this.managementActiveTab = 'management'; // 'management' | 'alchemy'
        this.activeTab = 'all';

        // Tag System State
        this.tag_created_order = 0;
        this.tags_registry = {}; 
        this.show_all_tags = false;
        this.selected_tag_label = null;
        this.is_tag_persona_mode = false;
        this.tagSortPrefs = { key: 'quantity', order: 'DESC' };

        // Sorting Preferences
        this.sortPrefs = {
            all: { key: 'created_order', order: 'ASC' },
            favorites: { key: 'created_order', order: 'ASC' },
            management: { key: 'created_order', order: 'ASC' }
        };

        // Init state from persistence
        this.loadSortPrefs();
        
        // Context-Aware Visibility Interceptor
        const originalRefresh = this.refreshManagementList.bind(this);
        this.refreshManagementList = (...args) => {
            const result = originalRefresh(...args);
            this.updateCreateButtonVisibility();
            return result;
        };
        
        const originalTagsRefresh = this.renderTagsContainer.bind(this);
        this.renderTagsContainer = (...args) => {
            const result = originalTagsRefresh(...args);
            this.updateCreateButtonVisibility();
            return result;
        };

        this.settlementHandler = (e) => {
            if (this.isOrphaned()) return;
            if (e.detail && e.detail.id === 'exp-persona') {
                requestAnimationFrame(() => requestAnimationFrame(() => {}));
            }
        };
        
        window.addEventListener('DOMINANCE_SETTLED', this.settlementHandler);
        
        this.createRequestHandler = () => {
            if (this.isOrphaned()) return;
            if (this.isManagementMode) this.handleCreate();
        };
        window.addEventListener('REQUEST_CREATE_PERSONA', this.createRequestHandler);
        
        this.alchemyIntegrationHandler = this.alchemyIntegrationHandler.bind(this);
        window.addEventListener('ALCHEMY_INTEGRATION_SUCCESS', this.alchemyIntegrationHandler);
        
        this.unsubActiveId = State.subscribe(this.keys.activeId, (id) => {
            if (this.isOrphaned()) return;
            this.onPersonaIdChange(id);
        });

        // Usage Tracking Hooks
        this.transmutationSuccessHandler = async (e) => {
            if (this.isOrphaned()) return;
            const { personaId, type } = e.detail || {};
            // Strictly prioritize the personaId from event to prevent race condition with activeId
            const targetId = personaId || this.activeId;
            if (!targetId) return;

            if (!type || type === 'transmutation') {
                const persona = this.items.find(p => p.id === targetId);
                if (persona && persona.tags) {
                    persona.tags.forEach(label => {
                        const normalized = String(label).trim().toLowerCase();
                        if (this.tags_registry[normalized]) {
                            this.tags_registry[normalized].used_times++;
                            this.tags_registry[normalized].last_used_time = Date.now();
                        }
                    });
                    await Storage.set({ tags_registry: this.tags_registry });
                    log('DATA', 'TAG_METRICS_UPDATED', { targetId, tags: persona.tags });
                }
            }
            
            await Persona.updateUsage(targetId);
        };
        window.addEventListener('TRANSMUTATION_SUCCESS', this.transmutationSuccessHandler);
        
        this.tagUpdateHandler = () => { if (this.isOrphaned()) return; this.recalculateTagMetadata(); };
        window.addEventListener('PERSONA_DATA_UPDATED', this.tagUpdateHandler);
        window.addEventListener('ALCHEMY_INTEGRATION_SUCCESS', this.tagUpdateHandler);

        this.dataUpdatedHandler = async () => {
            if (this.isOrphaned()) return;
            await this.loadSortPrefs();
        };
        window.addEventListener('PERSONA_DATA_UPDATED', this.dataUpdatedHandler);

        // Sync local component state with Global Mode Posture
        this.unsubManaging = State.subscribe('is_managing_personas', (isActive) => {
            if (this.isOrphaned()) return;
            if (this.isManagementMode !== isActive) {
                this.toggleManagementMode(isActive);
            }
        });

        // [V13.FIX] Bi-Directional Tab Switch Sanitizer
        // Ensures management state is cleared when leaving Forge AND text is healed when returning.
        this.tabSwitchHandler = (e) => {
            if (this.isOrphaned()) return;
            const target = e.detail?.target || e.detail?.id;
            if (!target) return;

            if (target !== 'Forge') {
                if (this.isManagementMode) {
                    log('UI', 'LIFECYCLE_EXIT', 'Forcing standard exit from Management Mode via Tab Switch.');
                    this.toggleManagementMode(false);
                }
                if (!this.isolationKey && State.get('assigning_persona_category_mode')) {
                    State.set('assigning_persona_category_mode', false);
                    State.set('assigning_persona_category_id', null);
                    log('UI', ['PERSONA', 'CATEGORY'], 'ASSIGN_MODE_EXIT', { reason: 'forge_leave' });
                }
                this.closeEditor(); // Ensure any overlays are purged
            } else {
                // If returning to Forge, forcefully run the janitor to clear shell-cached labels
                this.updateCreateButtonVisibility(true);
            }
        };
        window.addEventListener('alchimist:tab-switch', this.tabSwitchHandler, true);

        this.initTagSystem();
    }

    // [V13.FIX] Memory Leak Prevention
    isOrphaned() {
        if (this.isDestroyed) return true;
        const isMounted = this.container && document.body.contains(this.container);
        if (isMounted) {
            this.hasBeenMounted = true;
            return false;
        } else if (this.hasBeenMounted) {
            this.destroy();
            return true;
        }
        return false;
    }

    async initTagSystem() {
        const storedOrder = await Storage.get('tag_created_order');
        this.tag_created_order = storedOrder || 0;
        const storedRegistry = await Storage.get('tags_registry');
        this.tags_registry = storedRegistry || {};
        this.recalculateTagMetadata();
    }

    recalculateTagMetadata() {
        const newRegistry = {};
        for (let label in this.tags_registry) {
            const normalized = String(label).trim().toLowerCase();
            if (!newRegistry[normalized]) {
                newRegistry[normalized] = { ...this.tags_registry[label], quantity: 0, is_category: false, normalized };
            }
        }
        this.tags_registry = newRegistry;

        this.items.forEach(persona => {
            if (!persona.tags || !Array.isArray(persona.tags)) return;
            persona.tags.forEach((rawLabel, idx) => {
                const normalized = String(rawLabel).trim().toLowerCase();
                if (!this.tags_registry[normalized]) {
                    this.tags_registry[normalized] = { label: rawLabel, quantity: 0, used_times: 0, created_order: this.tag_created_order++, last_used_time: null, is_category: false, normalized };
                }
                this.tags_registry[normalized].quantity++;
                if (idx === 0) this.tags_registry[normalized].is_category = true;
            });
        });

        // [V23] Prune orphaned tags. The carry-forward above reset every known tag to
        // quantity:0 and KEPT the entry; the recount only re-increments tags still present
        // on a persona. A tag renamed or removed in the editor therefore ends at quantity:0
        // and would linger in the registry — and keep showing in the '#' tags list. Drop the
        // zero-count entries before persisting so the list reflects live usage only.
        const _prunedTags = [];
        for (const norm in this.tags_registry) {
            if (this.tags_registry[norm].quantity === 0) {
                delete this.tags_registry[norm];
                _prunedTags.push(norm);
            }
        }
        if (_prunedTags.length) log('DATA', 'TAGS_PRUNED', { count: _prunedTags.length, tags: _prunedTags });
        Storage.set({ tag_created_order: this.tag_created_order, tags_registry: this.tags_registry });
    }

    // [V15.fix3] Accepts optional `personas` array — when provided, the tag registry is
    // rebuilt restricted to tags actually appearing in that subset, with `quantity`
    // recomputed within scope. Callers without an arg get the global registry (legacy).
    getSortedTags(personas = null) {
        let registry = this.tags_registry;
        if (personas) {
            registry = {};
            personas.forEach(p => {
                if (!p.tags || !Array.isArray(p.tags)) return;
                p.tags.forEach(rawLabel => {
                    const norm = String(rawLabel).trim().toLowerCase();
                    if (!norm) return;
                    const globalMeta = this.tags_registry[norm];
                    if (!globalMeta) return;
                    if (!registry[norm]) registry[norm] = { ...globalMeta, quantity: 0 };
                    registry[norm].quantity += 1;
                });
            });
        }
        return Object.values(registry).sort((a, b) => {
            const mult = this.tagSortPrefs.order === 'DESC' ? -1 : 1;
            const { key } = this.tagSortPrefs;
            let diff = 0;

            if (key === 'quantity') diff = (a.quantity || 0) - (b.quantity || 0);
            else if (key === 'used_times') diff = (a.used_times || 0) - (b.used_times || 0);
            else if (key === 'last_used_time') diff = (a.last_used_time || 0) - (b.last_used_time || 0);
            else if (key === 'created_order') diff = (a.created_order || 0) - (b.created_order || 0);
            else if (key === 'ABC') return (a.label || '').toLowerCase().localeCompare((b.label || '').toLowerCase()) * mult;

            if (diff !== 0) return diff * mult;
            return (a.created_order || 0) - (b.created_order || 0); // Deterministic chronological tie-breaker
        });
    }

    async loadSortPrefs() {
        const favs = await Storage.get('favorite_personas') || [];
        const tab = await Storage.get(this.keys.activeTab) || 'all';
        const prefs = await Storage.get(this.keys.sortPrefs);
        const tagPrefs = await Storage.get(this.keys.tagSortPrefs);
        const tagViewState = await Storage.get(this.keys.tagViewState);
        
        State.set('favorite_personas', favs);
        this.activeTab = tab;
        if (prefs) this.sortPrefs = { ...this.sortPrefs, ...prefs };
        if (tagPrefs) this.tagSortPrefs = { ...this.tagSortPrefs, ...tagPrefs };
        log('DATA', 'PERSONA_SORT_PREFS_LOADED', { activeTab: tab });
        if (tagViewState) {
            this.is_tag_persona_mode = tagViewState.isActive;
            this.selected_tag_label = tagViewState.label;
        }

        let needsSave = false;
        let storedPersonas = await Storage.get('personas');

        // [V13.FIX] Integrity Guard: Recover corrupted registry if overwritten by a single object
        if (storedPersonas && !Array.isArray(storedPersonas)) {
            log('DATA', 'INTEGRITY_SHIELD_TRIGGERED', 'Converting corrupt registry back to array');
            storedPersonas = [storedPersonas];
            needsSave = true;
        }

        if (Array.isArray(storedPersonas)) {
            const cleanPersonas = storedPersonas.filter(p => p.id !== 'none');
            if (cleanPersonas.length !== storedPersonas.length) {
                storedPersonas = cleanPersonas;
                needsSave = true;
            }
        }
        if (!storedPersonas || storedPersonas.length === 0) {
            // [V16] Only re-seed defaults at genuine first-run. After a bundle revoke that empties
            // personas, respect the empty state instead of resurrecting the just-removed defaults.
            const isInit = await Storage.get('is_initialized');
            if (!isInit) {
                storedPersonas = JSON.parse(JSON.stringify(DEFAULT_PERSONAS));
                needsSave = true;
            } else {
                storedPersonas = [];
            }
        }

        let currentMaxOrder = storedPersonas.reduce((max, p) => Math.max(max, parseInt(p.created_order) || 0), 0);

        this.items = storedPersonas.map(p => {
            const updated = { ...p };
            if (updated.created_order === undefined) { updated.created_order = ++currentMaxOrder; needsSave = true; }
            if (updated.used_times === undefined) { updated.used_times = 0; needsSave = true; }
            if (updated.last_used_time === undefined) { updated.last_used_time = 0; needsSave = true; }
            return updated;
        });
        State.set('personas', this.items);

        if (this.selector && this.expander) {
            if (this.isManagementMode) {
                this.refreshManagementList();
            } else {
                this.renderNormalView();
            }
            log('UI', 'PERSONA_SORT_HYDRATED', { state: this.sortPrefs });
        }
    }

    async saveSortPrefs() {
        await Storage.set({ 
            [this.keys.sortPrefs]: this.sortPrefs,
            [this.keys.tagSortPrefs]: this.tagSortPrefs,
            [this.keys.activeTab]: this.activeTab
        });
    }

    static recordUsage(id) { Persona.updateUsage(id); }

    // [HEADER] Compose the expander sub-title as "<emoji> <name>" when the active
    // persona has an emoji; falls back to the bare name. Single formatter so every
    // subtitle site stays consistent.
    _subtitleLabel(p) {
        if (!p || !p.name) return '<no persona selected>';
        const emoji = (p.emoji || '').trim();
        return emoji ? `${emoji} ${p.name}` : p.name;
    }

    // [FIX] Single source of truth for the expander header sub-title.
    // Reads the CURRENT active persona from this.items, so a rename of the
    // active persona is reflected in the Forge header without an id change.
    syncActiveSubtitle() {
        if (!this.expander) return;
        if (this.activeId === 'none') {
            this.expander.updateSubtitle('<no persona selected>');
            return;
        }
        const current = this.items.find(p => p.id === this.activeId) || this.items[0];
        if (current) {
            this.expander.updateSubtitle(this._subtitleLabel(current));
        } else {
            this.expander.updateSubtitle(Language.text('MSG_NO_PERSONA_SELECTED') || '<no persona selected>');
        }
    }

    onPersonaIdChange(id) {
        if (!id) return;
        const persona = this.items.find(p => p.id === id);
        if (persona) {
            this.expander.updateSubtitle(this._subtitleLabel(persona));
        } else if (id === 'none') {
            this.expander.updateSubtitle('<no persona selected>');
        }
        this.activeId = id;
        
        if (!this.isolationKey) {
            window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
                detail: { key: 'active_persona_id', value: id } 
            }));
        }
            
    State.set(this.keys.activeId, id);
}

    get canCreatePersona() {
        return this.isManagementMode && this.managementActiveTab !== 'alchemy';
    }

    updateCreateButtonVisibility(force = false) {
        const syncVisibility = () => {
            // [V13.FIX] Strict Tab Guard
            // We allow execution if Forge is active OR if we are cleaning up from Manage mode.
            const isForgeActive = !!document.getElementById('forge-container')?.offsetParent;
            if (!isForgeActive && !this.isManagementMode && !force) return;

            const buttons = document.querySelectorAll('button, .action-gateway button');
            buttons.forEach(btn => {
                const span = btn.querySelector('span');
                const rawText = btn.textContent.trim().toLowerCase();
                
                // Detection logic for buttons in the "Management" or "Create" aspect
                const isManagementAction = rawText.includes('create persona') || 
                                    rawText.includes('add persona') || 
                                    rawText.includes('new persona') ||
                                    (rawText.includes('+') && rawText.includes('persona')) ||
                                    btn.classList.contains('create-persona-btn') ||
                                    btn.closest('.action-gateway');
                                    
                if (this.isManagementMode) {
                    if (isManagementAction) {
                        btn.style.setProperty('display', this.canCreatePersona ? '' : 'none', 'important');
                    }
                } else {
                    // [V13.FIX] Text Janitor (Self-Healing Logic)
                    // If we find a "Create" label while logically in Normal mode,
                    // forcefully heal it back to "Transmute". This bypasses Footer shell-caching.
                    if (span && (isManagementAction || btn.closest('.action-gateway'))) {
                        const transmuteText = Language.text('BTN_TRANSMUTE') || 'Transmute';
                        if (span.textContent.trim() !== transmuteText) {
                            span.textContent = transmuteText;
                            log('UI', 'BTN_TEXT_HEALED', 'Reverted stale Manage-text back to Transmute.');
                        }
                    }

                    if (isManagementAction || btn.closest('.action-gateway')) {
                        // If the text is still "Create" (hasn't been healed yet), 
                        // keep it hidden to prevent visual flickering of the wrong mode.
                        if (btn.textContent.toLowerCase().includes('create')) {
                            btn.style.setProperty('display', 'none', 'important');
                        } else {
                            // Once healed to "Transmute", ensure it is visible in the Forge.
                            if (isForgeActive) {
                                btn.style.removeProperty('display');
                            }
                        }
                    }
                }
            });
        };
        
        syncVisibility();
        // Settlement delays to ensure shell Footer has finished its re-render
        requestAnimationFrame(syncVisibility);
        setTimeout(syncVisibility, 100);
    }

    static async updateUsage(personaId) {
        let personas = await Storage.get('personas');
        if (!personas) return;
        
        const index = personas.findIndex(p => p.id === personaId);
        if (index !== -1) {
            personas[index].used_times = (parseInt(personas[index].used_times) || 0) + 1;
            personas[index].last_used_time = Date.now();
            State.set('personas', personas);
            window.dispatchEvent(new CustomEvent('PERSONA_DATA_UPDATED'));
        }
    }

    applySorting(items) {
        let viewType = this.isManagementMode ? 'management' : (this.activeTab === 'favorites' ? 'favorites' : 'all');
        if (!this.isManagementMode && this.activeTab === 'tags' && this.is_tag_persona_mode && this.selected_tag_label) {
            viewType = `tag_${this.selected_tag_label}`;
        }
        const pref = this.sortPrefs[viewType] || this.sortPrefs.all || { key: 'created_order', order: 'ASC' };
        const { key, order } = pref;
        const multiplier = order === 'ASC' ? 1 : -1;

        return [...items].sort((a, b) => {
            let result = 0;
            if (key === 'ABC') {
                result = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
            } else {
                const valA = Number(a[key]) || 0;
                const valB = Number(b[key]) || 0;
                result = valA - valB;
            }
            if (result === 0) return (Number(a.created_order) || 0) - (Number(b.created_order) || 0); // Deterministic chronological tie-breaker
            return result * multiplier;
        });
    }

    // [V14.5] Public helper for Preset's reset-to-defaults. Honors the current active tab + sort prefs
    // exactly as the rendered list would, so the "top persona" matches what the user sees.
    computeTopPersonaId() {
        const filtered = this.getFilteredItems();
        const sorted = this.applySorting(filtered);
        return (sorted && sorted[0] && sorted[0].id) || 'deep-tech-researcher';
    }

    async updateSortPref(viewType, changes) {
        this.sortPrefs[viewType] = { ...this.sortPrefs[viewType], ...changes };
        await this.saveSortPrefs();
        if (this.isManagementMode) {
            this.refreshManagementList();
        } else {
            this.renderNormalView();
        }
    }

    renderSortingTools() {
        const isTagSort = this.activeTab === 'tags' && !this.is_tag_persona_mode;
        let viewType = this.isManagementMode ? 'management' : (this.activeTab === 'favorites' ? 'favorites' : 'all');
        if (!this.isManagementMode && this.activeTab === 'tags' && this.is_tag_persona_mode && this.selected_tag_label) {
            viewType = `tag_${this.selected_tag_label}`;
        }
        const pref = isTagSort ? this.tagSortPrefs : (this.sortPrefs[viewType] || this.sortPrefs.all || { key: 'created_order', order: 'ASC' });

        const container = dom.create('div', 'persona-sorting-tools flex items-center h-full px-1');

        const toggle = dom.create('button', 'persona-sorting__toggle bg-surface-bright border-border-subtle rounded h-8 flex items-center justify-center cursor-pointer text-base text-text-secondary hover:text-text-primary transition-colors', {
            innerHTML: pref.order === 'ASC' ? '↓' : '↑',
            title: Language.text('SORT_TOGGLE_DESC') || 'Toggle Sort Order',
            onclick: (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isTagSort) {
                    const currentOrder = this.tagSortPrefs.order || 'ASC';
                    this.tagSortPrefs.order = currentOrder === 'ASC' ? 'DESC' : 'ASC';
                    log('UI', 'SORT_ORDER_FLIP', { context: 'tags', order: this.tagSortPrefs.order });
                    this.saveSortPrefs().then(() => this.refreshPersonaList());
                } else {
                    const currentPref = this.sortPrefs[viewType] || this.sortPrefs.all || { order: 'ASC' };
                    const nextOrder = currentPref.order === 'ASC' ? 'DESC' : 'ASC';
                    log('UI', 'SORT_ORDER_FLIP', { context: viewType, order: nextOrder });
                    this.updateSortPref(viewType, { order: nextOrder });
                }
            }
        });

        let options = [];
        if (isTagSort) {
            // Tag Sorting Matrix
            options = [
                { id: 'quantity', label: Language.text('SORT_QUANTITY') || 'Quantity' },                
                { id: 'used_times', label: Language.text('SORT_USED') || 'Used Times' },
                { id: 'last_used_time', label: Language.text('SORT_LAST_USED') || 'Last Used' },
                { id: 'created_order', label: Language.text('SORT_CREATED') || 'Created' },
                { id: 'ABC', label: Language.text('SORT_ABC') || 'Name' }
            ];
        } else {
            // Persona Sorting Matrix
            options = [                
                { id: 'last_used_time', label: Language.text('SORT_LAST_USED') || 'Last Used' },
                { id: 'created_order', label: Language.text('SORT_CREATED') || 'Created' },
                { id: 'used_times', label: Language.text('SORT_USED') || 'Used Times' },
                { id: 'ABC', label: Language.text('SORT_ABC') || 'Name' }
            ];
        }

        Dropdown.injectStyles();
        const selectedOption = options.find(o => o.id === pref.key) || options[0];

        if (this.currentDropdown && typeof this.currentDropdown.destroy === 'function') {
            this.currentDropdown.destroy();
        }   

        this.currentDropdown = new Dropdown(container, {
            items: options,
            placeholder: selectedOption.label,
            selectedId: pref.key,
            onSelect: (selected) => {
                const rawVal = selected?.id || selected?.value || selected;
                const matched = options.find(o => o.id === rawVal || o.label === rawVal);
                const newKey = matched ? matched.id : rawVal;
                
                const defaultOrders = {
                    'created_order': 'ASC',
                    'used_times': 'DESC',
                    'last_used_time': 'DESC',
                    'ABC': 'ASC',
                    'resonance': 'DESC',
                    'quantity': 'DESC'
                };
                
                if (isTagSort) {
                    this.tagSortPrefs.key = newKey;
                    this.tagSortPrefs.order = defaultOrders[newKey] || 'ASC';
                    this.saveSortPrefs().then(() => this.renderNormalView());
                } else {
                    this.updateSortPref(viewType, { key: newKey, order: defaultOrders[newKey] || 'ASC' });
                }
            }
        });

        container.appendChild(toggle);

        return container;
    }

    async alchemyIntegrationHandler(e) {
        if (this.isOrphaned()) return;
        const newPersona = e.detail;
        log('DATA', 'ALCHEMY_INTEGRATION_RECEIVED', { id: newPersona.id });
        await this.savePersona(newPersona, true);
    }

    async render() {
        log('UI', 'PERSONA_RENDER_START', { id: this.options.id || 'exp-persona' });
        // [V14.5] Expose primary forge instance for cross-component lookup (Preset reset-to-defaults).
        // Isolated/silent instances (alchemy slots) do NOT register so they don't shadow the main one.
        if (!this.isolationKey && !this.isSilent) {
            window.__alchimist_forge_persona = this;
        }
        const storedPersonas = await Storage.get('personas');
        if (Array.isArray(storedPersonas)) {
            const cleanPersonas = storedPersonas.filter(p => p.id !== 'none');
            if (cleanPersonas.length !== storedPersonas.length) {
                State.set('personas', cleanPersonas);
            }
            this.items = cleanPersonas;
            log('DATA', 'PERSONA_HYDRATED', { count: this.items.length, component: this.options.id });
        }

        const storedActiveId = await Storage.get(this.keys.activeId);
        if (storedActiveId && (storedActiveId === 'none' || this.items.some(p => p.id === storedActiveId))) {
            this.activeId = storedActiveId;
            
            // Sync hydrated state to volatile registry and notify orchestrators
            if (State.get(this.keys.activeId) !== storedActiveId) {
                setTimeout(() => {
                    State.set(this.keys.activeId, storedActiveId);
                    window.dispatchEvent(new CustomEvent('UI_PERSONA_CHANGE', { detail: { id: storedActiveId } }));
                }, 0);
            }
        }

        this.selector = new Selector({
            items: this.applySorting(this.getFilteredItems()),
            activeId: this.activeId,
            itemConstructor: Item,
            onSelect: (item, isReSelect) => this.handleSelect(item, isReSelect),
            emptyText: Language.text('MSG_NO_PERSONAS') || 'No personas available.'
        });

        this.selector.getItemOptions = (item) => ({
            isFavorite: (State.get('favorite_personas') || []).includes(item.id),
            onFavoriteToggle: (id) => this.toggleFavorite(id),
            ...this._categoryItemOptions(item)
        });

        log('LOGIC', 'PERSONA_INIT_EXPANDER', { configuredId: this.options.id, isSilent: this.isSilent });
        this.expander = new Expander({
            title: this.options.title || Language.text('TITLE_PERSONA'),
            id: this.options.id || 'exp-persona',
            isExpanded: this.options.isExpanded || false,
            groupId: this.isolationKey || this.options.groupId || 'forge-inputs',
            isDominantConfig: !this.isSilent,
            isSilent: this.isSilent,
            show_all: this.show_all,
            onToggle: (isExpanded) => {
                if (this.expander && this.expander.body) {
                    const tools = this.expander.body.querySelector('.persona-tools');
                    if (tools) tools.style.display = isExpanded ? '' : 'none';
                }

                if (!isExpanded && this.isManagementMode) {
                    this.toggleManagementMode(false);
                }
            }
        });

        const selectorNode = this.selector.render({ hasTools: !State.get('is_managing_personas') });
        const expanderNode = this.expander.render(selectorNode);

        if (!this.noManage) {
            this.manageBtn = dom.create('button', 'menu__item ml-auto mr-2 z-10 relative', {
                innerHTML: ICONS.MANAGE,
                title: Language.text('BTN_MANAGE_PERSONAS') || 'Manage',
                onclick: (e) => {
                    e.stopPropagation();
                    this.toggleManagementMode(!this.isManagementMode);
                }
            });
            
            const titleGroup = this.expander.header.querySelector('.expandable-title-group');
            if (titleGroup) {
                this.expander.header.insertBefore(this.manageBtn, this.expander.iconEl);
            }
        }
        
        const isManaging = State.get('is_managing_personas');
        if (!isManaging) {
            this.expander.body.insertBefore(this._renderTools(false), this.expander.body.firstChild);
        }

        this.container.appendChild(expanderNode);
        this.syncActiveSubtitle();
        
        if (!this.options.onSelect && !this.isolationKey) {
            window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
                detail: { key: 'active_persona_id', value: this.activeId } 
            }));
        }
    }

    async selectRandom() {
        const personas = this.items || DEFAULT_PERSONAS;
        const validPersonas = personas.filter(p => p.id !== 'none');
        if (validPersonas.length === 0) return;
        const random = validPersonas[Math.floor(Math.random() * validPersonas.length)];
        await this.handleSelect(random, false);
    }

    getActivePersona() {
        const personas = this.items || DEFAULT_PERSONAS;
        return personas.find(p => p.id === this.activeId);
    }

    async handleSelect(item, isReSelect) {
        log('UI', 'PERSONA_HANDLE_SELECT', { id: item.id, isReSelect, component: this.options.id });
        let targetItem = item;
        
        if (isReSelect) {
            if (this.options.allowNone && item.id !== 'none') {
                log('UI', 'PERSONA_RESELECT_CLEAR', { id: item.id });
                targetItem = { id: 'none', name: '<no persona selected>' };
            } else {
                this.expander.collapse();
                return;
            }
        }

        this.activeId = targetItem.id;
        if (this.selector) {
            this.selector.activeId = targetItem.id;
            this.selector.refresh();
        }
        this.expander.updateSubtitle(targetItem.id === 'none' ? '<no persona selected>' : this._subtitleLabel(targetItem));
        // (emoji prefix applied below via _subtitleLabel)
        this.expander.collapse();
        
        if (this.options.onSelect) {
            this.options.onSelect(targetItem, isReSelect);
        } else {
            if (!this.isolationKey) {
                window.dispatchEvent(new CustomEvent('STATE_UPDATE', { 
                    detail: { key: 'active_persona_id', value: targetItem.id } 
                }));
            }
        }
            
        State.set(this.keys.activeId, targetItem.id);
        window.dispatchEvent(new CustomEvent('UI_PERSONA_CHANGE', { detail: { id: targetItem.id } }));
        log('LOGIC', 'PERSONA_SYNC', { id: targetItem.id, component: this.options.id });
    }

    toggleManagementMode(isActive) {
        this.isManagementMode = isActive;
        this.updateCreateButtonVisibility();
        if (isActive) {
            this.manageBtn.classList.add('menu__item--active');
            this.expander.expand(true);
            this.expander.setDominantMode(true);
            if (this.expander.container) {
                this.expander.container.classList.add('is-management-scrolling');
            }
            window.dispatchEvent(new CustomEvent('ASPECT_CHANGE', { detail: { id: 'ManagePersonas' } }));
            window.dispatchEvent(new CustomEvent('MANAGE_PERSONAS_STATE', { detail: { isManaging: true, isEditing: false } }));
            this.renderManagementView();
        } else {
            this.manageBtn.classList.remove('menu__item--active');
            if (this.expander && this.expander.isExpanded) this.expander.collapse();
            if (this.expander.container) {
                this.expander.container.classList.remove('is-management-scrolling');
            }
            if (this.expander.contentWrapper) {
                this.expander.contentWrapper.style.overflow = '';
                this.expander.contentWrapper.style.padding = '';
                this.expander.contentWrapper.style.height = '';
            }
            window.dispatchEvent(new CustomEvent('ASPECT_CHANGE', { detail: { id: 'InfluenceCore' } }));
            window.dispatchEvent(new CustomEvent('MANAGE_PERSONAS_STATE', { detail: { isManaging: false, isEditing: false } }));
            setTimeout(() => {
                this.renderNormalView();
            }, 150);
        }
    }

    renderPersonaList(options = {}) {
        const { isManagement = false } = options;
        const container = isManagement ? this.managementList : this.expander.contentWrapper;
        if (!container) return;
        container.innerHTML = '';
        
        const parentForTools = isManagement ? container : this.expander.body;
        const existingTools = parentForTools.querySelector('.persona-tools');
        if (existingTools) existingTools.remove();
        
        const toolsPane = this._renderTools(isManagement);
        if (isManagement) {
            container.appendChild(toolsPane);
        } else {
            this.expander.body.insertBefore(toolsPane, container);
        }
        
        if (this.activeTab === 'tags') {
            this.renderTagsContainer(container);
            return;
        }

        if (this.activeTab === 'categories') {
            // Mount into a dedicated wrapper so Categories' own `host.innerHTML = ''` in
            // render() never wipes the tools pane (which lives INSIDE `container` in
            // management mode — it's a sibling of contentWrapper in normal mode).
            const catWrap = dom.create('div', `categories-mount-host ${isManagement ? 'manage-list flex-1 min-h-0' : ''}`.trim());
            container.appendChild(catWrap);
            if (!this._categoriesInstance) {
                this._categoriesInstance = new PersonaCategories(catWrap, this);
            } else {
                this._categoriesInstance.host = catWrap;
            }
            this._categoriesInstance.render();
            return;
        }

        const content = dom.create('div', `expandable-content ${isManagement ? 'manage-list' : ''}`.trim());
        container.appendChild(content);
        
        const processedItems = this.applySorting(this.getFilteredItems());
        
        const selector = new Selector({
            items: processedItems,
            activeId: isManagement ? null : this.activeId,
            onSelect: (item, isReSelect) => {
                if (isManagement) {
                    this.handleEdit(item);
                } else {
                    this.handleSelect(item, isReSelect);
                }
            },
            itemConstructor: {
                render: (item, isActive, onSelect, selectorOpts) => {
                    let actions = null;
                    let itemOpts = { 
                        ...selectorOpts,
                        isFavorite: (State.get('favorite_personas') || []).includes(item.id),
                        onFavoriteToggle: (id) => this.toggleFavorite(id || item.id)
                    };
                    if (!isManagement) {
                        Object.assign(itemOpts, this._categoryItemOptions(item));
                    }
                    
                    if (isManagement) {
                        actions = {
                            onEdit: () => this.handleEdit(item),
                            onDelete: () => this.handleDelete(item)
                        };
                        itemOpts.onFavoriteToggle = null; // Explicit suppression
                    }
                    
                    return Item.render(item, isActive, onSelect, actions, itemOpts);
                }
            }
        });
        
        content.appendChild(selector.render({ hasTools: true }));
        this.selector = selector;
    }

    _renderTools(isManagement) {
        const tools = dom.create('div', 'persona-tools flex items-center h-[42px] min-h-[42px]');
        tools.setAttribute('data-tab', String(this.activeTab));
        
        const tabsContainer = dom.create('div', 'persona-tools__tabs flex items-center h-full');
        const tabConfigs = [
            { id: 'all', label: '∞' },
            { id: 'tags', label: '#' },
            { id: 'favorites', label: '❤︎' }
        ];
        // [V15.fix4] Categories tab is now available in every Persona context: outer Forge,
        // Manage Personas, and Alchemy isolated slots. Mode-specific behavior is handled
        // by Categories.js itself (read of this.persona.isManagementMode / isolationKey).
        tabConfigs.push({ id: 'categories', label: '▤' });

        tabConfigs.forEach(cfg => {
            const tab = dom.create('div', `persona-tools__tab h-full flex items-center justify-center ${this.activeTab === cfg.id ? 'persona-tools__tab--active' : ''}`, {
                textContent: cfg.label
            });
            tab.onclick = () => {
                if (this.activeTab === 'categories' && cfg.id !== 'categories' && State.get('assigning_persona_category_mode')) {
                    State.set('assigning_persona_category_mode', false);
                    State.set('assigning_persona_category_id', null);
                    log('UI', ['PERSONA', 'CATEGORY'], 'ASSIGN_MODE_EXIT', { reason: 'tab_switch' });
                }
                State.set(this.keys.activeTab, cfg.id);
                Storage.set({ [this.keys.activeTab]: cfg.id });
                this.activeTab = cfg.id;
                this.refreshPersonaList();
            };
            tabsContainer.appendChild(tab);
        });
        tools.appendChild(tabsContainer);

        const sortingTools = this.renderSortingTools();
        tools.appendChild(sortingTools);
        return tools;
    }

    renderNormalView() {
        this.renderPersonaList({ isManagement: false });
        // [FIX] Keep the expander header in lockstep with the list on every
        // normal re-render (e.g. leaving management mode after a rename).
        this.syncActiveSubtitle();
    }

    // [V15] Persona Categories — derive the persona list-item bottom-right slot.
    // Returns {} for isolated (alchemy) instances so the slot never leaks there.
    _categoryItemOptions(item) {
        if (this.isolationKey) return {};
        const catId = item.category_id;
        if (catId) {
            const cat = (State.get('persona_categories') || []).find(c => c.id === catId);
            if (cat) return { categoryName: cat.name, onCategoryChip: () => this.navigateToCategory(catId) };
        }
        return { onAssignCategory: () => this.handleAssignCategory(item) };
    }

    handleAssignCategory(item) {
        State.set('assigning_persona_category_mode', true);
        State.set('assigning_persona_category_id', item.id);
        this.activeTab = 'categories';
        State.set(this.keys.activeTab, 'categories');
        Storage.set({ [this.keys.activeTab]: 'categories' });
        log('UI', ['PERSONA', 'CATEGORY'], 'ASSIGN_MODE_ENTER', { persona: item.id });
        this.refreshPersonaList();
    }

    navigateToCategory(catId) {
        this.activeTab = 'categories';
        State.set(this.keys.activeTab, 'categories');
        Storage.set({ [this.keys.activeTab]: 'categories' });
        this._pendingCategoryExpandId = catId;
        log('UI', ['CATEGORY', 'NAVIGATE'], { category: catId });
        this.refreshPersonaList();
    }

    renderTagsContainer(wrapper) {
        const container = dom.create('div', 'tags-container flex flex-wrap gap-2 p-2');
        
        if (this.is_tag_persona_mode) {
            this.renderTagPersonaMode(container);
        } else {
            const sorted = this.getSortedTags();
            sorted.forEach(tagMeta => {
                // [V13.RESILIENCY] Prevent crash if registry entry is lobotomized/corrupt
                if (!tagMeta || !tagMeta.label) {
                    log('w', 'UI', 'Skipped rendering corrupt tag metadata.');
                    return;
                }

                const isHidden = !tagMeta.is_category && !this.show_all_tags;
                const tag = new TagComponent({
                    content: tagMeta.label,
                    container: container,
                    data: { quantity: tagMeta.quantity || 0 },
                    display: 'quantity',
                    size: 'small'
                });
                if (isHidden) tag.el.style.display = 'none';
                tag.el.onclick = () => this.handleTagClick(tagMeta.label);

                // Semantic Tag Resonance on Hover
                tag.el.addEventListener('mouseenter', () => {
                    const normalizedHovered = String(tagMeta.label).trim().toLowerCase();
                    const relatedNorms = new Set([normalizedHovered]);

                    this.items.forEach(p => {
                        if (p.tags && p.tags.some(t => String(t).trim().toLowerCase() === normalizedHovered)) {
                            p.tags.forEach(t => relatedNorms.add(String(t).trim().toLowerCase()));
                        }
                    });

                    Array.from(container.children).forEach(sibling => {
                        if (sibling.tagInstance && sibling.tagInstance.content) {
                            const siblingLabel = String(sibling.tagInstance.content).trim().toLowerCase();
                            if (relatedNorms.has(siblingLabel)) {
                                sibling.style.opacity = '1';
                            } else {
                                sibling.style.opacity = '0.5';
                            }
                        }
                    });
                });

                tag.el.addEventListener('mouseleave', () => {
                    Array.from(container.children).forEach(sibling => {
                        if (sibling.tagInstance) {
                            sibling.style.opacity = '1';
                        }
                    });
                });
            });

            const hiddenTagsCount = sorted.filter(tagMeta => !tagMeta.is_category).length;
            if (!this.show_all_tags && hiddenTagsCount > 0) {
                const moreBtn = dom.create('button', 'px-2 py-1 rounded text-xs font-mono border border-border-subtle hover:bg-white/10 text-text-secondary transition-colors cursor-pointer inline-flex items-center self-center h-full', {
                    innerText: `+ ${hiddenTagsCount} more`,
                    onclick: () => { this.show_all_tags = true; this.renderNormalView(); }
                });
                container.appendChild(moreBtn);
            }
        }
        wrapper.appendChild(container);
    }

    renderTagPersonaMode(container) {
        const paneHeader = dom.create('div', 'tag_pane_container flex items-center gap-2 mb-3 w-full');
        const backBtn = dom.create('button', 'p-2 rounded hover:bg-white/10 text-text-secondary hover:text-text-primary flex-shrink-0 transition-colors cursor-pointer flex items-center justify-center', {
            innerHTML: ICONS?.BACK || '&#8592;',
            onclick: () => {
                this.updateTagViewState(false, null);
                this.renderNormalView();
            }
        });

        paneHeader.appendChild(backBtn);

        const normalizedSelected = String(this.selected_tag_label).trim().toLowerCase();
        const personasWithTag = this.items.filter(p => p.tags && p.tags.some(t => String(t).trim().toLowerCase() === normalizedSelected));
        const candidateNames = new Set();
        personasWithTag.forEach(p => {
            p.tags.forEach(tName => {
                const norm = String(tName).trim().toLowerCase();
                if (norm !== normalizedSelected) {
                    candidateNames.add(norm);
                }
            });
        });

        const relatedTags = Array.from(candidateNames)
            .map(name => this.tags_registry[name])
            .filter(tag => tag && tag.label && String(tag.label).trim().toLowerCase() !== normalizedSelected)
            .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
            .slice(0, 3);

        relatedTags.forEach(tagData => {
            const sTag = new TagComponent({
                content: tagData.label,
                container: paneHeader,
                data: { quantity: tagData.quantity },
                display: 'quantity',
                size: 'tiny'
            });
            sTag.el.onclick = () => this.handleTagClick(tagData.label);
        });

        container.appendChild(paneHeader);

        this.selector = new Selector({
            items: this.applySorting(personasWithTag),
            activeId: this.activeId,
            itemConstructor: Item,
            onSelect: (item) => this.handleSelect(item)
        });
        container.appendChild(this.selector.render({ hasTools: false }));
    }

    handleTagClick(label) {
        this.updateTagViewState(true, label);
        this.renderNormalView();
    }

    updateTagViewState(isActive, label) {
        this.is_tag_persona_mode = isActive;
        this.selected_tag_label = label;
        return Storage.set({ [this.keys.tagViewState]: { isActive, label } });
    }

    renderManagementView() {
        const wrapper = this.expander.contentWrapper;
        wrapper.innerHTML = '';

        const existingTools = this.expander.body.querySelector('.persona-tools');
        if (existingTools) {
            existingTools.remove();
        }
        
        wrapper.style.setProperty('overflow', 'hidden', 'important');
        wrapper.style.setProperty('padding', '0', 'important');
        wrapper.style.setProperty('height', '100%', 'important');

        const layoutWrapper = dom.create('div', 'flex flex-col h-full relative min-h-0');
        this.tabsWrapper = dom.create('div', 'flex-none sticky top-0 z-20', { id: 'persona-manage-tabs' });
        
        this.managementTabs = new Tabs({
            tabs: [
                { id: 'Repository', label: Language.text('TITLE_REPOSITORY'), icon: ICONS.BOOK_OPEN },
                { id: 'Alchemy', label: Language.text('TITLE_ALCHEMY'), icon: ICONS.FLASK }
            ],
            activeId: this.managementActiveTab === 'alchemy' ? 'Alchemy' : 'Repository',
            onSelect: (id) => {
                log('UI', 'PERSONA_TAB_CHANGE', { id });
                this.managementActiveTab = id === 'Alchemy' ? 'alchemy' : 'management';
                this.refreshManagementList();
            },
            className: 'w-full border-b border-[#2a2a32] bg-[#0a0a0c] mb-0'
        });
        this.tabsWrapper.appendChild(this.managementTabs.render());
        layoutWrapper.appendChild(this.tabsWrapper);

        this.managementList = dom.create('div', 'flex flex-col gap-2 flex-1 overflow-y-auto min-h-0', { id: 'persona-manage-ui' });
        this.refreshManagementList();
        layoutWrapper.appendChild(this.managementList);
        
        wrapper.appendChild(layoutWrapper);
    }

    handleCreate() {
        this.mountEditorOverlay(null);
    }

    handleEdit(persona) {
        this.mountEditorOverlay(persona);
    }

    mountEditorOverlay(persona) {
        if (State.get('is_editor_active')) {
            return log('LOGIC', 'EDITOR_ALREADY_ACTIVE');
        }

        window.dispatchEvent(new CustomEvent('MANAGE_PERSONAS_STATE', { detail: { isManaging: true, isEditing: true } }));
        State.set('is_persona_editor_active', true);
        
        const p = persona || {};
        let tagsStr = '';
        if (Array.isArray(p.tags)) {
            tagsStr = p.tags.join(', ');
        } else if (p.tags && typeof p.tags === 'string') {
            tagsStr = p.tags;
        } else if (p.category) {
            tagsStr = p.category;
        }

        const editor = new Editor({
            caption: (Language.text('TITLE_PERSONA') || 'Persona') + ' / ' + (p.name || 'New'),
            onSave: async (data) => {
                const tagsArr = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
                const finalData = {
                    id: p.id || crypto.randomUUID(),
                    // [PREMIUM] Mark editor-created personas so the free-tier count gate ignores
                    // seeded/default/bundle/synthesized personas (those stay unmarked).
                    userCreated: p.id ? !!p.userCreated : true,
                    name: data.name?.trim() || '',
                    emoji: data.emoji?.trim() || '',
                    tags: tagsArr,
                    desc: data.desc?.trim() || '',
                    prompt: data.prompt?.trim() || '',
                    linkIdentity: data.link_user_profile || false,
                    link_user_profile: data.link_user_profile || false,
                    // [V14.5] Learning gate — default ON when undefined (new personas) or explicitly true.
                    learns_from_context: data.learns_from_context !== false
                };
                await this.savePersona(finalData);
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input', { id: 'name', label: 'LABEL_NAME', value: p.name || '', placeholder: 'Name...' });
        editor.add('input', { id: 'emoji', label: 'LABEL_EMOJI', value: p.emoji || '', placeholder: 'Emoji...' });
        editor.add('input', { id: 'tags', label: 'LABEL_TAGS', value: tagsStr, placeholder: 'Tags...' });
        editor.add('input', { id: 'desc', label: 'LABEL_DESCRIPTION', value: p.desc || p.description || '', placeholder: 'Overview...' });
        editor.add('textarea', { id: 'prompt', label: 'LABEL_PROMPT_RULES', value: p.prompt || '', placeholder: 'Define systemic behavior...', rows: 8 });
        editor.add('switcher', { id: 'link_user_profile', label: 'LABEL_LINK_IDENTITY', initialState: p.link_user_profile || p.linkIdentity || false });
        // [V14.5] Persona Learning — default ON for both new (p={}) and existing without the field set.
        editor.add('switcher', { id: 'learns_from_context', label: 'LABEL_PERSONA_LEARNS', initialState: (p.learns_from_context !== false) });

        this.editorInstance = editor;
        editor.show();
    }

    async handleDelete(persona) {
        const confirmed = await Confirmation.show('Delete Persona', Language.text('CONFIRM_DELETE_PERSONA'));
        if (confirmed) {
            const wasActive = this.activeId === persona.id;
            this.items = this.items.filter(p => p.id !== persona.id);
            State.set('personas', this.items);
            await Storage.set({ personas: this.items }); // FIX: Persistence added
            window.dispatchEvent(new CustomEvent('PERSONA_DELETED', { detail: { type: 'persona', id: persona.id } }));

            // [Integrity cascade] Deleting the active identity must not strand the expander
            // sub-title on a ghost persona. Select the first surviving persona (by created_order);
            // only when none remain fall back to the existing 'none' -> <no persona selected> state.
            // onPersonaIdChange refreshes the sub-title, persists the id, and broadcasts the change.
            if (wasActive) {
                const sorted = [...this.items].sort((a, b) => (Number(a.created_order) || 0) - (Number(b.created_order) || 0));
                this.onPersonaIdChange(sorted[0]?.id || 'none');
            }

            this.refreshManagementList();
        }
    }



    getFilteredItems() {
        const tab = this.activeTab || 'all';
        const favorites = State.get('favorite_personas') || [];
        
        if (tab === 'favorites') {
            return this.items.filter(p => favorites.includes(p.id));
        }
        return this.items;
    }

    async toggleFavorite(id) {
        const favorites = State.get('favorite_personas') || [];
        const newFavs = favorites.includes(id) 
            ? favorites.filter(fid => fid !== id) 
            : [...favorites, id];
        
        State.set('favorite_personas', newFavs);
        await Storage.set({ favorite_personas: newFavs });
        
        if (!this.isManagementMode) {
           this.renderNormalView();
        }
    }

    async savePersona(data, skipClose = false) {
        let currentPersonas = await Storage.get('personas');

        // [V13.FIX] Integrity Guard: Catch un-arrayed data here as well
        if (currentPersonas && !Array.isArray(currentPersonas)) {
            currentPersonas = [currentPersonas];
        }

        if (!Array.isArray(currentPersonas) || currentPersonas.length === 0) {
            currentPersonas = [...this.items];
        }

        const idx = currentPersonas.findIndex(item => (item.id || item.name) === (data.id || data.name));
        if (idx !== -1) {
            const originalItem = currentPersonas[idx];
            currentPersonas[idx] = { 
                ...originalItem,
                ...data, 
                created_order: originalItem.created_order,
                used_times: originalItem.used_times,
                last_used_time: originalItem.last_used_time
            };
        } else {
            const maxOrder = currentPersonas.reduce((max, p) => Math.max(max, parseInt(p.created_order) || 0), 0);
            data.created_order = maxOrder + 1;
            currentPersonas.push(data);
        }
        
        this.items = currentPersonas;
        // [PERF] Persist through Storage FIRST so the Density-Gate compression
        // cache (_densityCompressionCache) is warm before State's debounced
        // reactive persist fires. 'personas' is a _configKey, so State.set()
        // schedules its own Storage.set() ~150ms later; previously both writes
        // raced, missed the cache, and each ran a full ~3.5s main-thread LZMA
        // pass on the ~854KB blob (two COMPRESS_TIMING entries per save).
        // With the awaited write completing first, the second write serializes
        // to an identical payload and short-circuits via DENSITY_CACHE_HIT.
        await Storage.set({ personas: this.items });
        State.set('personas', this.items);
        // [FIX] If the edited persona is the active one, its name in the Forge
        // expander header is now stale (the id didn't change, so onPersonaIdChange
        // never fired). Re-sync the sub-title from the freshly-saved data.
        if (data && data.id === this.activeId) this.syncActiveSubtitle();
        window.dispatchEvent(new CustomEvent('PERSONA_DATA_UPDATED'));
        if (!skipClose) this.closeEditor();
    }

    closeEditor() {
        State.set('is_persona_editor_active', false);
        // [V13.FIX] Standard Exit Reconciliation: Use current instance state instead of hardcoded true.
        window.dispatchEvent(new CustomEvent('MANAGE_PERSONAS_STATE', { 
            detail: { isManaging: this.isManagementMode, isEditing: false } 
        }));
        this.refreshManagementList();
    }

    refreshPersonaList() {
        if (this.isManagementMode) {
            this.refreshManagementList();
        } else {
            this.renderNormalView();
        }
    }

    destroy() {
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
        this.isDestroyed = true;
        if (this.unsubActiveId) this.unsubActiveId();
        if (this.unsubManaging) this.unsubManaging();
        window.removeEventListener('DOMINANCE_SETTLED', this.settlementHandler);
        window.removeEventListener('REQUEST_CREATE_PERSONA', this.createRequestHandler);
        window.removeEventListener('ALCHEMY_INTEGRATION_SUCCESS', this.alchemyIntegrationHandler);
        window.removeEventListener('TRANSMUTATION_SUCCESS', this.transmutationSuccessHandler);
        window.removeEventListener('PERSONA_DATA_UPDATED', this.tagUpdateHandler);
        window.removeEventListener('ALCHEMY_INTEGRATION_SUCCESS', this.tagUpdateHandler);
        window.removeEventListener('PERSONA_DATA_UPDATED', this.dataUpdatedHandler);
        window.removeEventListener('alchimist:tab-switch', this.tabSwitchHandler, true);
        if (this.currentDropdown && typeof this.currentDropdown.destroy === 'function') {
            this.currentDropdown.destroy();
        }
        if (this.expander && typeof this.expander.destroy === 'function') {
            this.expander.destroy();
        }
        if (this.editorBackdrop) {
            this.editorBackdrop.remove();
        }
        if (this._activeAlchemyInstance && typeof this._activeAlchemyInstance.destroy === 'function') {
            this._activeAlchemyInstance.destroy();
            this._activeAlchemyInstance = null;
        }
        if (this._categoriesInstance && typeof this._categoriesInstance.destroy === 'function') {
            this._categoriesInstance.destroy();
            this._categoriesInstance = null;
        }
    }

    refreshManagementList() {
        if (!this.managementList) return;
        
        // [V14] Concurrency Lock (Mutex)
        if (this._isRefreshingManagement) return;
        this._isRefreshingManagement = true;
        
        // Instance Disposal (Anti-Ghosting)
        if (this._activeAlchemyInstance && typeof this._activeAlchemyInstance.destroy === 'function') {
            this._activeAlchemyInstance.destroy();
            this._activeAlchemyInstance = null;
        }
        
        this.managementList.innerHTML = '';

        if (this.managementActiveTab === 'alchemy') {
            this._activeAlchemyInstance = new Alchemy();
            this._activeAlchemyInstance.render().then(alchemyNode => {
                if (this.managementActiveTab !== 'alchemy' || this.isDestroyed || !this.managementList) {
                    this._isRefreshingManagement = false;
                    return;
                }
                alchemyNode.className = 'flex flex-col flex-1 h-full w-full';
                this.managementList.appendChild(alchemyNode);
                window.dispatchEvent(new CustomEvent('DOMINANCE_SETTLED', { detail: { id: 'exp-persona' } }));
                this._isRefreshingManagement = false;
            }).catch(() => {
                this._isRefreshingManagement = false;
            });
        } else {
            this.renderPersonaList({ isManagement: true });
            this._isRefreshingManagement = false;
        }
    }

    // [V15.fix3] Accepts a context object (or legacy boolean `isManagement`) that lets
    // external callers (Categories.js) reuse this exact code with a scoped personas
    // array, an external drill-state holder, and custom select/itemConstructor.
    renderTagPersonaMode(container, ctxOrIsManagement = {}) {
        const ctx = (typeof ctxOrIsManagement === 'boolean') ? { isManagement: ctxOrIsManagement } : (ctxOrIsManagement || {});
        const isManagement = !!ctx.isManagement;
        const personas    = ctx.personas    || this.items;
        const state       = ctx.state       || this;
        const onTagClick  = ctx.onTagClick  || ((label) => this.handleTagClick(label));
        const onExitTagMode = ctx.onExitTagMode || (() => { this.updateTagViewState(false, null); this.refreshPersonaList(); });
        const sortFn      = ctx.sortFn      || ((items) => this.applySorting(items));
        const activeId    = (ctx.activeId !== undefined) ? ctx.activeId : (isManagement ? null : this.activeId);

        const paneHeader = dom.create('div', 'tag_pane_container flex items-center gap-2 mb-3 w-full');
        const backBtn = dom.create('button', 'p-2 rounded hover:bg-white/10 text-text-secondary hover:text-text-primary flex-shrink-0 transition-colors cursor-pointer flex items-center justify-center', {
            innerHTML: ICONS?.BACK || '&#8592;',
            onclick: () => onExitTagMode()
        });

        paneHeader.appendChild(backBtn);

        const normalizedSelected = String(state.selected_tag_label).trim().toLowerCase();
        const personasWithTag = personas.filter(p => p.tags && p.tags.some(t => String(t).trim().toLowerCase() === normalizedSelected));
        const candidateNames = new Set();
        personasWithTag.forEach(p => {
            p.tags.forEach(tName => {
                const norm = String(tName).trim().toLowerCase();
                if (norm !== normalizedSelected) {
                    candidateNames.add(norm);
                }
            });
        });

        const relatedTags = Array.from(candidateNames)
            .map(name => this.tags_registry[name])
            .filter(tag => tag && tag.label && String(tag.label).trim().toLowerCase() !== normalizedSelected)
            .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
            .slice(0, 3);

        relatedTags.forEach(tagData => {
            const sTag = new TagComponent({
                content: tagData.label,
                container: paneHeader,
                data: { quantity: tagData.quantity },
                display: 'quantity',
                size: 'tiny'
            });
            sTag.el.onclick = () => onTagClick(tagData.label);
        });

        container.appendChild(paneHeader);

        const selector = new Selector({
            items: sortFn(personasWithTag),
            activeId,
            onSelect: (item, isReSelect) => {
                if (isManagement) {
                    this.handleEdit(item);
                } else if (ctx.onSelect) {
                    ctx.onSelect(item, isReSelect);
                } else {
                    this.handleSelect(item, isReSelect);
                }
            },
            itemConstructor: ctx.itemConstructor || {
                render: (item, isActive, onSelect, selectorOpts) => {
                    let actions = null;
                    let itemOpts = { 
                        ...selectorOpts,
                        isFavorite: (State.get('favorite_personas') || []).includes(item.id),
                        onFavoriteToggle: (id) => this.toggleFavorite(id || item.id)
                    };
                    
                    if (isManagement) {
                        actions = {
                            onEdit: () => this.handleEdit(item),
                            onDelete: () => this.handleDelete(item)
                        };
                        itemOpts.onFavoriteToggle = null; // Explicit suppression
                    }
                    
                    return Item.render(item, isActive, onSelect, actions, itemOpts);
                }
            }
        });
        
        container.appendChild(selector.render({ hasTools: false }));
    }

    // [V15.fix3] Accepts optional context for scoped reuse (Categories.js).
    // Default behavior (no ctx) is unchanged: the outer Persona pane's tags view.
    renderTagsContainer(wrapper, ctx = {}) {
        const isManagement = (ctx.isManagement !== undefined) ? ctx.isManagement : this.isManagementMode;
        const personas     = ctx.personas     || this.items;
        const state        = ctx.state        || this;
        const onTagClick   = ctx.onTagClick   || ((label) => this.handleTagClick(label));
        const refreshFn    = ctx.refreshFn    || (() => this.refreshPersonaList());
        const scopedTags   = !!ctx.personas; // scope the registry only when caller provided a subset

        const container = dom.create('div', `tags-container flex flex-wrap gap-2 p-2 content-start items-start ${isManagement ? 'manage-list' : ''}`.trim());
        
        if (state.is_tag_persona_mode) {
            this.renderTagPersonaMode(container, { ...ctx, isManagement, personas, state, onTagClick, refreshFn });
        } else {
            const sorted = this.getSortedTags(scopedTags ? personas : null);
            sorted.forEach(tagMeta => {
                // [V13.RESILIENCY] Prevent crash if registry entry is lobotomized/corrupt
                if (!tagMeta || !tagMeta.label) {
                    log('w', 'UI', 'Skipped rendering corrupt tag metadata.');
                    return;
                }

                const isHidden = !tagMeta.is_category && !state.show_all_tags;
                const tag = new TagComponent({
                    content: tagMeta.label,
                    container: container,
                    data: { quantity: tagMeta.quantity || 0 },
                    display: 'quantity',
                    size: 'small'
                });
                if (isHidden) tag.el.style.display = 'none';
                tag.el.onclick = () => onTagClick(tagMeta.label);

                // Semantic Tag Resonance on Hover
                tag.el.addEventListener('mouseenter', () => {
                    const normalizedHovered = String(tagMeta.label).trim().toLowerCase();
                    const relatedNorms = new Set([normalizedHovered]);

                    personas.forEach(p => {
                        if (p.tags && p.tags.some(t => String(t).trim().toLowerCase() === normalizedHovered)) {
                            p.tags.forEach(t => relatedNorms.add(String(t).trim().toLowerCase()));
                        }
                    });

                    Array.from(container.children).forEach(sibling => {
                        if (sibling.tagInstance && sibling.tagInstance.content) {
                            const siblingLabel = String(sibling.tagInstance.content).trim().toLowerCase();
                            if (relatedNorms.has(siblingLabel)) {
                                sibling.style.opacity = '1';
                            } else {
                                sibling.style.opacity = '0.5';
                            }
                        }
                    });
                });

                tag.el.addEventListener('mouseleave', () => {
                    Array.from(container.children).forEach(sibling => {
                        if (sibling.tagInstance) {
                            sibling.style.opacity = '1';
                        }
                    });
                });
            });

            const hiddenTagsCount = sorted.filter(tagMeta => !tagMeta.is_category).length;
            if (!state.show_all_tags && hiddenTagsCount > 0) {
                const moreBtn = dom.create('button', 'px-2 py-1 rounded text-xs font-mono border border-border-subtle hover:bg-white/10 text-text-secondary transition-colors cursor-pointer inline-flex items-center', {
                    innerText: `+ ${hiddenTagsCount} more`,
                    onclick: () => { state.show_all_tags = true; refreshFn(); }
                });
                container.appendChild(moreBtn);
            }
        }
        wrapper.appendChild(container);
    }

    handleTagClick(label) {
        this.updateTagViewState(true, label);
        this.refreshPersonaList();
    }

}