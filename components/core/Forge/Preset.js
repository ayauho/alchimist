/**
 * @file components/core/Forge/Preset.js
 * @purpose UI: Global Schema Configuration Presets manager.
 *          Captures and restores full Forge state including Intelligence peer+intent pair.
 */
import { Expander } from '../../reusable/Expander.js';
import { dom } from '../../../utils/dom.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { Storage } from '../../../services/Storage.js';
import { ICONS } from '../../../utils/assets.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { PROTOCOL_CONFIG } from './Protocols.js';
import { Editor } from '../../reusable/Editor.js';
import { Language } from '../../../services/Language.js';
import Dropdown from '../../reusable/Dropdown.js';

export class Preset {
    constructor(container) {
        this.container = container;
        this.id = 'exp-preset';
        this.items = [];
        this.isEditing = false;
        this.editingId = null;

        // [V14.5] Preset Tools — tabs ('all' | 'favorites'), per-tab sort prefs, favorites list.
        this.presetActiveTab = 'all';
        this.presetSortPrefs = {
            all:       { key: 'created_order', order: 'ASC' },
            favorites: { key: 'created_order', order: 'ASC' }
        };
        this.favoritePresets = [];
        this.currentDropdown = null;

        // [V14.5] Bump usage metrics on successful transmute when this preset is active.
        this.handleTransmuteSuccess = () => this.onTransmutationSuccess();
        window.addEventListener('TRANSMUTATION_SUCCESS', this.handleTransmuteSuccess);
        

        this.handleCreateClicked = () => {
            log('LOGIC', 'CREATE_PRESET_SIGNAL_RECEIVED', { instance: this.id });
            this.mountEditorOverlay();
        };

        // [V13.S³] Consistency Engine: Stabilized Subscriptions
        this.unsubscribers = [];
        const debouncedCheck = () => {
            clearTimeout(this._consistencyTimer);
            this._consistencyTimer = setTimeout(() => this.checkConsistency(), 100);
        };

        // Watch all keys that affect preset consistency — including Intelligence pair
        const watchKeys = [
            'personas_active_id', 'interactionType', 'mode',
            'imperatives', 'attachments', 'metrics',
            'active_peer_id', 'active_intent_id',
             'active_article_id',
            ...Object.keys(PROTOCOL_CONFIG)
        ];
        watchKeys.forEach(k => this.unsubscribers.push(State.subscribe(k, debouncedCheck)));

        this.unsubscribers.push(State.subscribe('active_preset_id', (id) => {
            if (id) {
                const target = this.items.find(x => x.id === id);
                if (target && this.expander) this.expander.updateSubtitle(target.name);
            } else if (this.expander) {
                this.expander.updateSubtitle(null);
            }
        }));

        // Integrity cascade: entity deletion propagates into affected preset snapshots
        this.integrityHandler = (e) => this.handleIntegrityCleanup(e.detail);
        window.addEventListener('PERSONA_DELETED',    this.integrityHandler);
        window.addEventListener('IMPERATIVE_DELETED', this.integrityHandler);
        window.addEventListener('ATTACHMENT_DELETED', this.integrityHandler);
        window.addEventListener('PEER_DELETED',       this.integrityHandler);
        window.addEventListener('INTENT_DELETED',     this.integrityHandler);
         window.addEventListener('ARTICLE_DELETED',   this.integrityHandler);
        // [V14] Metric integrity cascade — METRIC_DELETED arrives from Forge/Metric.js (Phase 10);
        // until then no event fires, the subscription is dormant.
        window.addEventListener('METRIC_DELETED',    this.integrityHandler);

        this.expander = new Expander({
            id: this.id,
            title: 'Presets',
            isDominantConfig: true,
            premiumLocked: true,
            groupId: 'forge-main',
            onToggle: (isExpanded) => { State.set('is_managing_presets', isExpanded); }
        });

        window.addEventListener('CREATE_PRESET_CLICKED', this.handleCreateClicked);
        log('LIFECYCLE', 'PRESET_INSTANCE_CREATED', { containerId: container.id });
    }

    // [V18.2] Renamed initialize() -> render() to conform to the orchestrator's
    // awaitable mount contract (mirrors Article.js). Forge.render() awaits this
    // inside Promise.all so the preset expander settles within the hydration window.
    async render() {
        const stored = await Storage.get('presets');
        this.items = stored || [];

        // [V14.5] Backfill created_order on any pre-update preset that lacks it.
        // Stable assignment by current array order — first record gets 1.
        let needsBackfill = false;
        let _maxCreated = this.items.reduce((m, p) => Math.max(m, Number(p.created_order) || 0), 0);
        this.items.forEach(p => {
            if (typeof p.created_order !== 'number') {
                _maxCreated += 1;
                p.created_order = _maxCreated;
                needsBackfill = true;
            }
            if (typeof p.used_times     !== 'number') p.used_times     = 0;
            if (typeof p.last_used_time !== 'number') p.last_used_time = 0;
        });
        if (needsBackfill) {
            await Storage.set({ presets: this.items });
            log('DATA', 'PRESET_CREATED_ORDER_BACKFILL', { count: this.items.length });
        }        
        State.set('presets', this.items);

        const savedActive = await Storage.get('active_preset_id');
        State.set('active_preset_id', savedActive);
         // [V18.11] Capture the Storage-authoritative restored id in a render-local-backed
         // field. The guard must latch on THIS, not on State.get('active_preset_id'), because
         // checkConsistency() itself mutates that State key — an early half-hydrated scan can
         // null it before any guarded scan runs, after which a State-based guard can never
         // re-engage. This value is the source of truth until full hydration settles.
         this._restoredPresetId = savedActive || null;
        // [V14.5] Hydrate tools prefs from Storage (memory-first sovereignty).
        const _storedTab    = await Storage.get('preset_active_tab');
        const _storedPrefs  = await Storage.get('preset_sorting_prefs');
        const _storedFavs   = await Storage.get('favorite_presets');
        if (_storedTab === 'all' || _storedTab === 'favorites') this.presetActiveTab = _storedTab;
        if (_storedPrefs && typeof _storedPrefs === 'object') {
            if (_storedPrefs.all)       this.presetSortPrefs.all       = { ...this.presetSortPrefs.all,       ..._storedPrefs.all };
            if (_storedPrefs.favorites) this.presetSortPrefs.favorites = { ...this.presetSortPrefs.favorites, ..._storedPrefs.favorites };
        }
        if (Array.isArray(_storedFavs)) this.favoritePresets = _storedFavs;
        State.set('favorite_presets', this.favoritePresets);

        const node = this.expander.render();
        this.container.appendChild(node);


        this.refresh();
         // [V18.11] Hydration guard — whole-state, not pair-specific. On cold reload, MANY
         // contributors (entity lists' used/active flags, protocols, Intelligence pair,
         // article) arrive in an unspecified order inside the concurrent Forge hydration
         // window. checkConsistency() is a DESTRUCTIVE reconciler: a scan against half-loaded
         // state finds no match and wipes the Storage-restored active_preset_id. The fix:
         // (1) the Storage-restored id is authoritative; (2) suppress ALL scans until the
         // single "all expanders hydrated" signal fires; (3) even then, never let a scan
         // CLEAR the restored id — only confirm a positive match. The post-settle scan runs
         // once everything is present, so the genuine match is found and the preset re-activates.
         this._hydrating = true;
         const _settleAndScan = async () => {
             if (!this._hydrating) return;
             clearTimeout(this._hydrationTimer);
             log('LOGIC', 'PRESET_CONSISTENCY_DEFERRED', { reason: 'forge-hydration-settled' });
             // [TREASURY+ FIX-B] Keep the latch ENGAGED across the async scan so checkConsistency's
             // guard (`if (_hydrating && !newActiveId && _restoredPresetId) return;`) actually fires
             // when the scan body runs after its awaits. The restored id may re-affirm but can never
             // be nulled by a false negative — enforces the documented V18.11 "never clear during
             // restore" invariant that the prior pre-await `_hydrating = false` silently bypassed.
             try { await this.checkConsistency(); }
             finally { this._hydrating = false; }
         };
         // FORGE_HYDRATION_SETTLED fires after all Forge expanders finish hydrating (entities,
         // protocols, intelligence pair, article) — the only point at which gatherCurrentState()
         // reflects the true restored state.
         window.addEventListener('FORGE_HYDRATION_SETTLED', _settleAndScan, { once: true });
         // Safety net in case the settle event was already dispatched or never fires.
         this._hydrationTimer = setTimeout(_settleAndScan, 2500);
         // NOTE: intentionally NO scan here. Running checkConsistency() now would reconcile
         // against half-hydrated state and wipe the restored id (the V18.10 defect).
    }

    refresh() {
        const body = this.expander.body;
        if (!body) return;
        body.innerHTML = '';
        body.appendChild(this._renderTools());
        body.appendChild(this.renderList());

        const activeId = State.get('active_preset_id');
        if (activeId) {
            const target = this.items.find(x => x.id === activeId);
            if (target && this.expander) this.expander.updateSubtitle(target.name);
        } else if (this.expander) {
            // No active preset — ensure subtitle is cleared
            this.expander.updateSubtitle(null);
        }

    }


    // [CLEAR] Auxiliary-selection clear behind the header "clear" link. Forces Protocols to
    // VSA-only and clears imperatives, attachments, intelligence, metrics, articles and the
    // active preset — WITHOUT touching Persona, Strategy or Mode.
    async _clearForgeSelections() {
        log('LOGIC', 'FORGE_CLEAR_INITIATED');

        // Protocols — VSA on, everything else off. Free-tier `signature` keeps its forced branding.
        for (const key of Object.keys(PROTOCOL_CONFIG)) {
            const target = (key === 'void_source_auditor') || (key === 'signature' && !License.isPremium());
            State.set(key, target);
            await Storage.set({ [key]: target });
        }

        // Imperatives / Metrics — clear active+used flags (single-key content domains).
        for (const key of ['imperatives', 'metrics']) {
            const arr = (await Storage.get(key)) || [];
            arr.forEach(i => { i.used = false; i.active = false; });
            await Storage.set({ [key]: arr });
            State.set(key, arr);
        }

        // Attachments — lightweight projection only (MODEL-B: never echo the heavy content blob).
        let _atts = State.get('attachments');
        if (!Array.isArray(_atts)) _atts = (await Storage.get('attachments')) || [];
        const _lightAtts = (Array.isArray(_atts) ? _atts : []).map(a => ({
            id: a.id, name: a.name, preview: a.preview, used: false
        }));
        await Storage.set({ attachments: _lightAtts });
        State.set('attachments', _lightAtts);
        await Storage.set({ attachments_active_ids: [] });

        // Intelligence pair.
        State.set('active_peer_id',          null);
        State.set('active_peer_intelligence', null);
        State.set('active_intent_id',         null);
        State.set('active_intent_text',       null);
        await Storage.set({ forge_active_peer_id: null, forge_active_intent_id: null });

        // Article + active preset.
        State.set('active_article_id', null);
        await Storage.set({ active_article_id: null });
        State.set('active_preset_id', null);
        await Storage.set({ active_preset_id: null });

        // Broadcast cascade so children re-hydrate selectors / subtitles / switchers.
        window.dispatchEvent(new CustomEvent('PRESET_APPLIED', { detail: { id: null, name: '__defaults__', snapshot: null } }));

        log('DATA', 'FORGE_CLEAR_COMPLETE');
        this.refresh();
    }

    renderList() {
        const listWrapper = dom.create('div', 'preset-list flex flex-col w-full');
        // [V14.5] Filter by active tab BEFORE the empty-check so an empty favorites tab
        // renders its own message rather than reporting "no presets at all".
        const _filtered = this.presetActiveTab === 'favorites'
            ? this.items.filter(p => this.favoritePresets.includes(p.id))
            : this.items;
        const _sorted = this._applySorting(_filtered);

        if (!_sorted || _sorted.length === 0) {
            listWrapper.appendChild(dom.create('div', 'text-xs text-text-secondary italic text-center p-4', {
                innerText: this.presetActiveTab === 'favorites'
                    ? (Language.text('MSG_NO_FAVORITE_PRESETS') || 'No favorite presets.')
                    : (Language.text('MSG_NO_PRESETS') || 'No presets available.')
            }));
            return listWrapper;
        }

        _sorted.forEach(item => {
            const row = dom.create('div', 'preset-item item-row flex items-center justify-between p-3 border-b border-zinc-800 hover:bg-white/5 transition-colors cursor-pointer group w-full min-w-0 overflow-hidden');
            row.dataset.id = item.id;
            row.onclick = () => this.applyPreset(item);

            const isActive = State.get('active_preset_id') === item.id;
            const left = dom.create('div', 'item-row__left flex-shrink-0 mr-4');
            left.innerHTML = `<div class="radio-indicator w-4 h-4 rounded-full border-2 border-zinc-600 ${isActive ? 'bg-zinc-600 border-zinc-600 is-checked' : ''}"></div>`;
            left.onclick = (e) => { e.stopPropagation(); this.applyPreset(item); };

            const middle = dom.create('div', 'item-row__middle flex flex-col flex-1 w-0 min-w-0 overflow-hidden py-1 gap-1');
            const titleEl = dom.create('div', 'preset-name font-bold text-sm text-text-primary break-words leading-tight', { innerText: item.name });

            const snap = item.snapshot || item.schema || {};
            const badges = [];

            // [FIX] Preset labels (persona / imperative / attachment / article / metric names)
            // are user-authored and may contain <, >, & — e.g. "!<kairos:protocol>". They were
            // interpolated raw into schemaEl.innerHTML, so an angle bracket opened an unclosed
            // tag that swallowed every following badge as a nested child, collapsing the flex
            // row (overlap / mis-wrap). Escape all dynamic text before it enters the markup.
            const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
            ));

            if (snap.persona_id || snap.persona) {
                const pName = snap.persona?.short || snap.persona?.name || (snap.persona_id || '').split('_').pop();
                badges.push(`<span class="protocol-indicator" style="color: var(--color-persona, #a78bfa); border: 1px solid rgba(167,139,250,0.3);">@${esc(pName.toUpperCase())}</span>`);
            }
            if (snap.strategy) {
                badges.push(`<span class="protocol-indicator" style="color: var(--color-strategy, #60a5fa); border: 1px solid rgba(96,165,250,0.3);">[${esc(snap.strategy.toUpperCase())}]</span>`);
            }
            if (snap.mode) {
                badges.push(`<span class="protocol-indicator" style="color: var(--color-mode, #f472b6); border: 1px solid rgba(244,114,182,0.3);">#${esc(snap.mode.toUpperCase())}</span>`);
            }
            if (snap.imperatives?.length) {
                snap.imperatives.forEach(i => {
                    badges.push(`<span class="protocol-indicator" style="color: var(--color-imperative, #fbbf24); border: 1px solid rgba(251,191,36,0.3);">!${esc(i.short)}</span>`);
                });
            }
            if (snap.attachments?.length) {
                snap.attachments.forEach(a => {
                    badges.push(`<span class="protocol-indicator" style="color: var(--color-attachment, #34d399); border: 1px solid rgba(52,211,153,0.3);">+${esc(a.short)}</span>`);
                });
            }
             if (snap.article) {
                 badges.push(`<span class="protocol-indicator" style="color: var(--color-article, #06b6d4); border: 1px solid rgba(6,182,212,0.3);">📄${esc(snap.article.short)}</span>`);
             }
            // [V14] Custom-metric badges — amber-400 palette (#facc15) per plan §1 confirmation.
            // Glyph `▸` differentiates them from imperatives (`!`) and attachments (`+`).
            if (snap.metrics?.length) {
                snap.metrics.forEach(m => {
                    badges.push(`<span class="protocol-indicator" style="color: var(--color-metric, #facc15); border: 1px solid rgba(250,204,21,0.3);">▸${esc(m.short)}</span>`);
                });
            }
            if (snap.protocols?.length) {
                snap.protocols.forEach(p => {
                    const conf  = PROTOCOL_CONFIG[p.id];
                    const color = conf ? conf.color : 'var(--text-secondary)';
                    badges.push(`<span class="protocol-indicator" style="color: ${color}; border: 1px solid ${color};">${esc(conf ? conf.abbrev : p.short)}</span>`);
                });
            }
            // [V13.S³] Intelligence indicator — combined, only when BOTH peer and intent saved
            if (snap.peer && snap.intent) {
                badges.push(`<span class="protocol-indicator" style="color: #818cf8; border: 1px solid rgba(129,140,248,0.4);">⊕${esc(snap.peer.short)}+${esc(snap.intent.short)}</span>`);
            }

            const schemaEl = dom.create('div', 'preset-schema flex gap-1.5 flex-wrap items-center mt-0.5');
            schemaEl.innerHTML = badges.length
                ? badges.join('')
                : '<span class="text-[10px] italic text-text-secondary">Empty Snapshot</span>';

            middle.appendChild(titleEl);
            middle.appendChild(schemaEl);

            const right = dom.create('div', 'item-row__right flex items-center gap-1 shrink-0 pr-2');
            const btnClass = 'text-zinc-600 hover:text-blue-400 transition-colors p-1.5 rounded flex items-center justify-center hover:bg-white/5';

            // [V14.5] ❤︎ favorite toggle — sits FIRST in right cluster to mirror persona row.
            const _isFav = this.favoritePresets.includes(item.id);
            const btnFav = dom.create('button', `${btnClass.replace('hover:text-blue-400', 'hover:text-pink-400')} ${_isFav ? 'text-pink-400' : ''}`, { title: _isFav ? 'Unfavorite' : 'Favorite' });
            btnFav.innerHTML = _isFav ? (ICONS?.HEART_FULL || '❤') : (ICONS?.HEART_HOLLOW || '♡');
            const _svgF = btnFav.querySelector('svg');
            if (_svgF) { _svgF.style.width = '16px'; _svgF.style.height = '16px'; } else { btnFav.style.fontSize = '16px'; }
            btnFav.onclick = (e) => { e.stopPropagation(); this.toggleFavorite(item.id); };

            const btnUpdate = dom.create('button', btnClass, { title: 'Update with current state' });
            btnUpdate.innerHTML = ICONS?.REFRESH || '⟳';
            const svgU = btnUpdate.querySelector('svg');
            if (svgU) { svgU.style.width = '16px'; svgU.style.height = '16px'; } else { btnUpdate.style.fontSize = '16px'; }
            btnUpdate.onclick = async (e) => {
                e.stopPropagation();
                item.snapshot = await this.gatherCurrentState();
                await Storage.set({ presets: this.items });
                State.set('presets', this.items);
                log('DATA', 'PRESET_UPDATED', { id: item.id, name: item.name });
                State.set('active_preset_id', item.id);
                await Storage.set({ active_preset_id: item.id });
                if (this.expander) this.expander.toggle(false);
                this.refresh();
            };

            const btnEdit = dom.create('button', btnClass, { title: 'Edit Name' });
            btnEdit.innerHTML = ICONS?.EDIT || '✎';
            const svgE = btnEdit.querySelector('svg');
            if (svgE) { svgE.style.width = '16px'; svgE.style.height = '16px'; } else { btnEdit.style.fontSize = '16px'; }
            btnEdit.onclick = (e) => { e.stopPropagation(); this.mountEditorOverlay(item); };

            const btnDelete = dom.create('button', btnClass.replace('hover:text-blue-400', 'hover:text-red-400'), { title: 'Delete Preset' });
            btnDelete.innerHTML = ICONS?.TRASH || '✕';
            const svgD = btnDelete.querySelector('svg');
            if (svgD) { svgD.style.width = '16px'; svgD.style.height = '16px'; } else { btnDelete.style.fontSize = '16px'; }
            btnDelete.onclick = async (e) => {
                e.stopPropagation();
                if (await Confirmation.show(
                    Language.text('TITLE_DELETE') || 'Delete Preset',
                    Language.text('CONFIRM_DELETE_PRESET') || 'Are you sure?'
                )) {
                    const deletedId = item.id;
                    this.items = this.items.filter(x => x.id !== deletedId);
                    await Storage.set({ presets: this.items });
                    // If the deleted preset was active, clear the subtitle and active state
                    if (State.get('active_preset_id') === deletedId) {
                        State.set('active_preset_id', null);
                        await Storage.set({ active_preset_id: null });
                    }
                    this.refresh();
                }
            };

            right.appendChild(btnUpdate);
            right.appendChild(btnEdit);
            right.appendChild(btnDelete);
            right.insertBefore(btnFav, btnUpdate);
            row.appendChild(left);
            row.appendChild(middle);
            row.appendChild(right);
            listWrapper.appendChild(row);
        });

        return listWrapper;
    }

    // [V14.5] Tools pane: ∞/❤︎ tabs + sorting dropdown. Mirrors Persona._renderTools without 'tags'.
    _renderTools() {
        const tools = dom.create('div', 'preset-tools flex items-center h-[42px] min-h-[42px]');
        tools.setAttribute('data-tab', String(this.presetActiveTab));

        const tabsContainer = dom.create('div', 'preset-tools__tabs flex items-center h-full');
        const tabConfigs = [
            { id: 'all',       label: '∞' },
            { id: 'favorites', label: '❤︎' }
        ];

        tabConfigs.forEach(cfg => {
            const isActive = this.presetActiveTab === cfg.id;
            const tab = dom.create('div', `preset-tools__tab h-full flex items-center justify-center ${isActive ? 'preset-tools__tab--active' : ''}`, {
                textContent: cfg.label
            });
            tab.onclick = () => {
                this.presetActiveTab = cfg.id;
                State.set('preset_active_tab', cfg.id);
                Storage.set({ preset_active_tab: cfg.id });
                this.refresh();
            };
            tabsContainer.appendChild(tab);
        });
        tools.appendChild(tabsContainer);

        tools.appendChild(this._renderSortingTools());
        return tools;
    }

    _renderSortingTools() {
        const pref = this.presetSortPrefs[this.presetActiveTab] || this.presetSortPrefs.all;
        const container = dom.create('div', 'preset-sorting-tools flex items-center h-full px-1');

        const toggle = dom.create('button', 'preset-sorting__toggle bg-surface-bright border-border-subtle rounded h-8 flex items-center justify-center cursor-pointer text-base text-text-secondary hover:text-text-primary transition-colors', {
            innerHTML: pref.order === 'ASC' ? '↓' : '↑',
            title: Language.text('SORT_TOGGLE_DESC') || 'Toggle Sort Order',
            onclick: (e) => {
                e.stopPropagation();
                e.preventDefault();
                pref.order = pref.order === 'ASC' ? 'DESC' : 'ASC';
                log('UI', 'PRESET_SORT_ORDER_FLIP', { tab: this.presetActiveTab, order: pref.order });
                this._saveSortPrefs().then(() => this.refresh());
            }
        });

        const options = [
            { id: 'last_used_time', label: Language.text('SORT_LAST_USED') || 'Last Used' },
            { id: 'created_order',  label: Language.text('SORT_CREATED')   || 'Created' },
            { id: 'used_times',     label: Language.text('SORT_USED')      || 'Used Times' },
            { id: 'ABC',            label: Language.text('SORT_ABC')       || 'Name' }
        ];

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
                    'last_used_time': 'DESC',
                    'used_times':     'DESC',
                    'created_order':  'ASC',
                    'ABC':            'ASC'
                };

                this.presetSortPrefs[this.presetActiveTab] = {
                    key: newKey,
                    order: defaultOrders[newKey] || 'ASC'
                };
                this._saveSortPrefs().then(() => this.refresh());
            }
        });

        container.appendChild(toggle);
        return container;
    }

    _applySorting(items) {
        const pref = this.presetSortPrefs[this.presetActiveTab] || this.presetSortPrefs.all || { key: 'created_order', order: 'ASC' };
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
            // Deterministic tie-breaker — created_order ASC always.
            if (result === 0) return (Number(a.created_order) || 0) - (Number(b.created_order) || 0);
            return result * multiplier;
        });
    }

    async _saveSortPrefs() {
        await Storage.set({
            preset_sorting_prefs: this.presetSortPrefs,
            preset_active_tab:    this.presetActiveTab
        });
    }

    async toggleFavorite(id) {
        const next = this.favoritePresets.includes(id)
            ? this.favoritePresets.filter(x => x !== id)
            : [...this.favoritePresets, id];
        this.favoritePresets = next;
        State.set('favorite_presets', next);
        await Storage.set({ favorite_presets: next });
        log('UI', 'PRESET_FAVORITE_TOGGLED', { id, isFav: next.includes(id) });
        this.refresh();
    }

    async onTransmutationSuccess() {
        const activeId = State.get('active_preset_id');
        if (!activeId) return;
        const target = this.items.find(p => p.id === activeId);
        if (!target) return;
        target.last_used_time = Date.now();
        target.used_times     = (Number(target.used_times) || 0) + 1;
        await Storage.set({ presets: this.items });
        State.set('presets', this.items);
        log('DATA', 'PRESET_USAGE_BUMPED', { id: activeId, used_times: target.used_times });
        this.refresh();
    }

    mountEditorOverlay(item = null) {
        if (State.get('is_editor_active')) return log('LOGIC', 'EDITOR_ALREADY_ACTIVE');
        if (this.isEditing) return;
        this.isEditing = true;
        this.editingId = item ? item.id : null;
        State.set('is_preset_editor_active', true);

        const editor = new Editor({
            caption: item
                ? (Language.text('TITLE_EDIT_PRESET')   || 'EDIT PRESET')
                : (Language.text('TITLE_CREATE_PRESET') || 'CREATE PRESET'),
            captionClass: 'input-label text-[10px]',
            saveText:   Language.text('BTN_SAVE')   || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const val = data.presetName?.trim();
                if (val) {
                    if (this.editingId) {
                        const target = this.items.find(x => x.id === this.editingId);
                        if (target) {
                            target.name = val;
                            await Storage.set({ presets: this.items });
                        }
                        State.set('presets', this.items);
                    } else {
                        await this.createPreset(val);
                    }
                    if (this.expander) this.expander.toggle(false);
                } else {
                    throw new Error('Preset name cannot be empty');
                }
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input', {
            id: 'presetName',
            placeholder: Language.text('PLACEHOLDER_PRESET_NAME') || 'Enter preset name...',
            value: item ? item.name : '',
            className: 'alchimist-input w-full text-sm p-3 bg-black/20 focus:outline-none',
            inputType: 'text'
        });

        this.editorInstance = editor;
        editor.show();
    }

    closeEditor() {
        this.isEditing = false;
        this.editingId = null;
        this.editorInstance = null;
        State.set('is_preset_editor_active', false);
        this.refresh();
    }

    async checkConsistency() {
        // [V18.5] Skip the expensive gatherCurrentState() scan while a preset apply is
        // in flight — applyPreset() commits active_preset_id explicitly, so running the
        // match scan mid-apply is redundant work against stale intermediate state.
        if (this._isApplying) return;
        const current = await this.gatherCurrentState();

        const matchedPreset = this.items.find(p => {
            const s = p.snapshot;
            if (!s) return false;

            // Scalar match — includes Intelligence peer+intent pair
            const matchBasic =
                s.persona_id === current.persona_id   &&
                s.strategy   === current.strategy     &&
                s.mode       === current.mode         &&
                (s.peer_id   || null) === (current.peer_id   || null) &&
                 (s.intent_id || null) === (current.intent_id || null) &&
                 (s.article_id || null) === (current.article_id || null);
            if (!matchBasic) return false;

            const matchIds = (snapList, currentList) => {
                const idsA = (snapList || []).map(x => x.id).sort().join(',');
                const idsB = (currentList || []).map(x => x.id).sort().join(',');
                return idsA === idsB;
            };

            return (
                matchIds(s.imperatives, current.imperatives) &&
                matchIds(s.attachments, current.attachments) &&
                matchIds(s.metrics,     current.metrics)     &&
                matchIds(s.protocols,   current.protocols)
            );
        });

        const newActiveId = matchedPreset ? matchedPreset.id : null;
        // [TREASURY+ TEMP DIAG] One-shot field diff to confirm WHICH restored field fails the
        // match (plan §7). Remove once `attachments` is confirmed as the sole mismatch.
        try {
            const _expectId = this._restoredPresetId || State.get('active_preset_id');
            const _exp = _expectId && this.items.find(p => p.id === _expectId);
            if (_exp && _exp.snapshot && !matchedPreset) {
                const s = _exp.snapshot, c = current;
                const _ids = l => (l || []).map(x => x.id).sort().join(',');
                const diff = {};
                if (s.persona_id !== c.persona_id) diff.persona_id = { snap: s.persona_id, current: c.persona_id };
                if (s.strategy !== c.strategy) diff.strategy = { snap: s.strategy, current: c.strategy };
                if (s.mode !== c.mode) diff.mode = { snap: s.mode, current: c.mode };
                if ((s.peer_id || null) !== (c.peer_id || null)) diff.peer_id = { snap: s.peer_id, current: c.peer_id };
                if ((s.intent_id || null) !== (c.intent_id || null)) diff.intent_id = { snap: s.intent_id, current: c.intent_id };
                if ((s.article_id || null) !== (c.article_id || null)) diff.article_id = { snap: s.article_id, current: c.article_id };
                if (_ids(s.imperatives) !== _ids(c.imperatives)) diff.imperatives = { snap: _ids(s.imperatives), current: _ids(c.imperatives) };
                if (_ids(s.attachments) !== _ids(c.attachments)) diff.attachments = { snap: _ids(s.attachments), current: _ids(c.attachments) };
                if (_ids(s.metrics) !== _ids(c.metrics)) diff.metrics = { snap: _ids(s.metrics), current: _ids(c.metrics) };
                if (_ids(s.protocols) !== _ids(c.protocols)) diff.protocols = { snap: _ids(s.protocols), current: _ids(c.protocols) };
                log('DATA', 'PRESET_CONSISTENCY_DIFF', { presetId: _expectId, diff });
            }
        } catch (e) { log('e', 'PRESET_CONSISTENCY_DIFF_FAIL', { err: e.message }); }
          // [V18.11] While hydrating, the Storage-restored id (_restoredPresetId) is
          // authoritative. A null result here is almost always a false negative against
          // half-loaded state, so NEVER clear during hydration — only a positive match may
          // proceed (to re-affirm). Latch on _restoredPresetId, NOT State.get(), because this
          // function mutates that State key and an earlier scan may have already nulled it.
          if (this._hydrating && !newActiveId && this._restoredPresetId) {
              log('LOGIC', 'PRESET_REACTIVATION_DEFERRED', { kept: this._restoredPresetId });
              return;
          }
         if (State.get('active_preset_id') !== newActiveId) {
            State.set('active_preset_id', newActiveId);
            Storage.set({ active_preset_id: newActiveId });
            this.refresh();
             if (newActiveId) log('LOGIC', 'PRESET_REACTIVATED_POST_SYNC', { id: newActiveId });
        }
    }

    async applyPreset(item) {
        log('LOGIC', 'APPLYING_PRESET', { id: item.id, name: item.name });
        // [V18.5] Suppress the debounced checkConsistency() that the State.set() calls
        // below would otherwise trigger mid-apply. We KNOW this preset is the active one
        // after applying, so the expensive gatherCurrentState() scan is redundant here —
        // we set active_preset_id explicitly at the end. Guard cleared in a finally.
        this._isApplying = true;
        const snap = item.snapshot || item.schema || {};

        // 1. Identity Restoration
        if (snap.persona_id) {
            State.set('personas_active_id', snap.persona_id);
            await Storage.set({ personas_active_id: snap.persona_id });
            window.dispatchEvent(new CustomEvent('PERSONA_SELECTED', { detail: { id: snap.persona_id } }));
        }
        if (snap.strategy) { State.set('interactionType', snap.strategy); await Storage.set({ interactionType: snap.strategy }); }
        if (snap.mode)     { State.set('mode', snap.mode);                await Storage.set({ mode: snap.mode }); }

        // 2. Entity List Restoration
        const restoreUsed = async (key, snapList) => {
            const current = (await Storage.get(key)) || [];
            const snapIds = new Set((snapList || []).map(x => x.id));
            current.forEach(i => { i.used = snapIds.has(i.id); i.active = i.used; });
            // [V18.9] Update in-memory State without scheduling State._persist (avoids the
            // 150ms-timer shadow Storage.set of the large blob).
            State._data[key] = current;
            State.notify(key, current);
            if (key === 'attachments') {
                // [V18.9] ROOT FIX: do NOT rewrite the 321KB content array on preset apply.
                // The only thing apply changes is WHICH attachments are active.
                // [V18.13] Lockstep the lightweight 'attachments' mirror with the selection SoT.
                // Strip to a content-free projection so the write stays tiny (no density gate /
                // no LZMA) and the heavy `attachments_registry` is never touched. Without this
                // the persisted mirror keeps stale used:true and loadItems() resurrects it.
                const activeIds = current.filter(i => i.used).map(i => i.id);
                const light = current.map(({ id, name, preview, used }) => ({ id, name, preview, used }));
                await Storage.set({ attachments: light, attachments_active_ids: activeIds });
                log('DATA', 'PRESET_ATTACHMENT_MIRROR_SYNCED', { active: activeIds.length });
            } else {
                await Storage.set({ [key]: current });
            }
        };
        // [V18.5] These three restorations are independent — run them concurrently
        // instead of three sequential await chains (each doing its own get+set round-trip).
        await Promise.all([
            restoreUsed('imperatives', snap.imperatives),
            restoreUsed('attachments', snap.attachments),
            // [V14] Custom metrics use the same active/used lockstep as imperatives/attachments.
            restoreUsed('metrics', snap.metrics)
        ]);

        // 3. Protocol Restoration
        const snapProtIds = new Set((snap.protocols || []).map(x => x.id));
        await Promise.all(Object.keys(PROTOCOL_CONFIG).map(async key => {
            const isActive = snapProtIds.has(key);
            State.set(key, isActive);
            await Storage.set({ [key]: isActive });
        }));

        // 4. Intelligence Peer + Intent Restoration
        // Always explicit: if snapshot has no pair, existing selection MUST be cleared.
        if (snap.peer_id) {
            await Storage.set({ forge_active_peer_id: snap.peer_id });
            State.set('active_peer_id', snap.peer_id);
            State.set('active_peer_intelligence', await Storage.get(`peer_intelligence_${snap.peer_id}`) || null);
        } else {
            await Storage.set({ forge_active_peer_id: null });
            State.set('active_peer_id',          null);
            State.set('active_peer_intelligence', null);
        }

        if (snap.intent_id) {
            const intents = await Storage.get('intents') || [];
            const intent  = intents.find(i => i.id === snap.intent_id);
            await Storage.set({ forge_active_intent_id: snap.intent_id });
            State.set('active_intent_id',   snap.intent_id);
            State.set('active_intent_text', intent ? intent.text : null);
        } else {
            await Storage.set({ forge_active_intent_id: null });
            State.set('active_intent_id',   null);
            State.set('active_intent_text', null);
        }

        log('LOGIC', 'PRESET_INTELLIGENCE_RESTORE', {
            peer_id:   snap.peer_id   || null,
            intent_id: snap.intent_id || null
        });

         // 5. Article Restoration — Both-or-None (mirrors Intelligence pair pattern)
         if (snap.article_id) {
             State.set('active_article_id', snap.article_id);
             await Storage.set({ active_article_id: snap.article_id });
         } else {
             State.set('active_article_id', null);
             await Storage.set({ active_article_id: null });
         }
         log('LOGIC', 'PRESET_ARTICLE_RESTORE', { article_id: snap.article_id || null });

        State.set('active_preset_id', item.id);
        await Storage.set({ active_preset_id: item.id });

        // PRESET_APPLIED triggers Forge/Intelligence._restoreFromStorage()
        // which syncs its selectors and clear-button visibility from State set above.
        window.dispatchEvent(new CustomEvent('PRESET_APPLIED', { detail: item }));
        if (this.expander) this.expander.toggle(false);
        // [V18.5] Clear the apply guard now that active_preset_id is committed.
        this._isApplying = false;
        this.refresh();
    }

    async createPreset(name) {
        log('LOGIC', 'GATHERING_STATE_FOR_PRESET', { name });
        const snapshot = await this.gatherCurrentState();
        // [V14.5] Sortable metrics — created_order is monotonic, last_used_time/used_times start at 0
        // (only successful transmutation bumps usage per spec).
        const _maxCreated = this.items.reduce((m, p) => Math.max(m, Number(p.created_order) || 0), 0);        
        const newPreset = {
            id:        'preset_' + crypto.randomUUID(),
            name,
            snapshot,
            createdAt:      Date.now(),
            created_order:  _maxCreated + 1,
            last_used_time: 0,
            used_times:     0
        };
        this.items.push(newPreset);
        await Storage.set({ presets: this.items });
        State.set('presets', this.items);
        log('DATA', 'PRESET_CREATED', { id: newPreset.id, snapshot });
        State.set('active_preset_id', newPreset.id);
        await Storage.set({ active_preset_id: newPreset.id });
    }

    async handleIntegrityCleanup({ type, id }) {
        if (!this.items || this.items.length === 0) return;
        let modified = false;

        if (type === 'persona') {
            const initialLen = this.items.length;
            this.items = this.items.filter(p => p.snapshot?.persona_id !== id);
            if (this.items.length !== initialLen) modified = true;

        } else if (type === 'imperative' || type === 'attachment' || type === 'metric') {
            // [V14] Metric deletion cascade joins this branch — identical filter shape, only
            // the storage-key mapping differs.
            const arrayKey = type === 'imperative' ? 'imperatives' : type === 'attachment' ? 'attachments' : 'metrics';
            this.items.forEach(preset => {
                if (preset.snapshot && Array.isArray(preset.snapshot[arrayKey])) {
                    const initialLen = preset.snapshot[arrayKey].length;
                    preset.snapshot[arrayKey] = preset.snapshot[arrayKey].filter(item => item.id !== id);
                    if (preset.snapshot[arrayKey].length !== initialLen) modified = true;
                }
            });

        } else if (type === 'peer') {
            // Peer deleted: wipe the entire peer+intent pair from any affected preset
            this.items.forEach(preset => {
                if (preset.snapshot?.peer_id === id) {
                    preset.snapshot.peer_id   = null;
                    preset.snapshot.peer      = null;
                    preset.snapshot.intent_id = null;
                    preset.snapshot.intent    = null;
                    modified = true;
                }
            });

        } else if (type === 'intent') {
            // Intent deleted: wipe the entire peer+intent pair from any affected preset
            this.items.forEach(preset => {
                if (preset.snapshot?.intent_id === id) {
                    preset.snapshot.peer_id   = null;
                    preset.snapshot.peer      = null;
                    preset.snapshot.intent_id = null;
                    preset.snapshot.intent    = null;
                    modified = true;
                }
            });

         } else if (type === 'article') {
             // Article deleted: wipe article reference from any affected preset
             this.items.forEach(preset => {
                 if (preset.snapshot?.article_id === id) {
                     preset.snapshot.article_id = null;
                     preset.snapshot.article    = null;
                     modified = true;
                 }
             });
        }

        if (modified) {
            log('LOGIC', 'PRESET_INTEGRITY_CASCADE', { type, id });
            await Storage.set({ presets: this.items });
            State.set('presets', this.items);
            this.refresh();
        }
    }

    async gatherCurrentState() {
        let storedImps = State.get('imperatives');
        if (storedImps === undefined) storedImps = await Storage.get('imperatives');
        storedImps = storedImps || [];

        let storedAtts = State.get('attachments');
        if (storedAtts === undefined) storedAtts = await Storage.get('attachments');
        storedAtts = storedAtts || [];

        // [V14] Hydration parity with imperatives/attachments — State first, Storage fallback.
        let storedMetrics = State.get('metrics');
        if (storedMetrics === undefined) storedMetrics = await Storage.get('metrics');
        storedMetrics = storedMetrics || [];

        let storedPersonas = State.get('personas');
        if (storedPersonas === undefined) storedPersonas = await Storage.get('personas');
        storedPersonas = storedPersonas || [];

        let interactionType = State.get('interactionType');
        if (interactionType === undefined) interactionType = await Storage.get('interactionType');
        interactionType = interactionType || 'rewrite';

        let mode = State.get('mode');
        if (mode === undefined) mode = await Storage.get('mode');
        mode = mode || 'single';

        let activePersonaId = State.get('personas_active_id');
        if (activePersonaId === undefined) activePersonaId = await Storage.get('personas_active_id');
        if (activePersonaId === undefined) activePersonaId = await Storage.get('persona_active_id');

        const activePersona = storedPersonas.find(p => p.id === activePersonaId);
        const truncate = (str) => typeof str === 'string' ? str.substring(0, 15) : '';

         // [ARTICLE] Capture active article + title (mirrors persona snapshot pattern)
         let activeArticleId = State.get('active_article_id');
         if (activeArticleId === undefined) activeArticleId = await Storage.get('active_article_id');
         activeArticleId = activeArticleId || null;

         let storedArticles = State.get('articles');
         if (storedArticles === undefined) storedArticles = await Storage.get('articles');
         storedArticles = storedArticles || [];

         const activeArticle = activeArticleId ? storedArticles.find(a => a.id === activeArticleId) : null;

        const activeProtocols = [];
        // [V18.5] Resolve all protocol keys concurrently. Previously this was a sequential
        // for-loop of ~17 awaits, each yielding the event loop — the dominant cost of the
        // checkConsistency() tail that runs after every preset apply.
        const _protocolKeys = Object.keys(PROTOCOL_CONFIG);
        const _protocolVals = await Promise.all(_protocolKeys.map(async key => {
            let val = State.get(key);
            if (val === undefined) val = await Storage.get(key);
            return val;
        }));
        _protocolKeys.forEach((key, idx) => {
            if (_protocolVals[idx] === true) activeProtocols.push({ id: key, short: PROTOCOL_CONFIG[key].abbrev });
        });

        // [V13.S³] Intelligence pair: State-only, both-or-none (enforced by Forge/Intelligence._syncState)
        // Never fall back to Storage — null State = pair not active.
        const activePeerId   = State.get('active_peer_id')   || null;
        const activeIntentId = State.get('active_intent_id') || null;

        let snapPeer   = null;
        let snapIntent = null;

        if (activePeerId && activeIntentId) {
            const peers   = await Storage.get('peers')   || [];
            const intents = await Storage.get('intents') || [];
            const peer    = peers.find(p => p.id === activePeerId);
            const intent  = intents.find(i => i.id === activeIntentId);
            if (peer && intent) {
                snapPeer   = { id: peer.id,   short: peer.name.split(' ')[0] };
                snapIntent = { id: intent.id, short: intent.text.split(' ').slice(0, 2).join(' ') };
            }
        }

        log('LOGIC', 'PRESET_INTELLIGENCE_CAPTURE', {
            peer_id:   activePeerId,
            intent_id: activeIntentId,
            captured:  !!(snapPeer && snapIntent)
        });

        return {
            persona_id:  activePersonaId,
            persona:     activePersona ? { id: activePersona.id, short: truncate(activePersona.name) } : null,
            strategy:    interactionType,
            mode,
            imperatives: storedImps.filter(i => i.active || i.used).map(i => ({ id: i.id, short: truncate(i.text || i.name) })),
            attachments: storedAtts.filter(a => a.used).map(a => ({ id: a.id, short: truncate(a.name) })),
            // [V14] Custom metrics — same active/used filter as imperatives (lockstep toggle).
            metrics:     storedMetrics.filter(m => m.active || m.used).map(m => ({ id: m.id, short: truncate(m.name) })),
            protocols:   activeProtocols,
            peer_id:     snapPeer   ? activePeerId   : null,
            peer:        snapPeer,
            intent_id:   snapIntent ? activeIntentId : null,
             intent:      snapIntent,
             article_id:  activeArticle ? activeArticleId : null,
             article:     activeArticle ? { id: activeArticle.id, short: truncate((activeArticle.attributes && activeArticle.attributes.title) || '') } : null
        };
    }

    destroy() {
        window.removeEventListener('CREATE_PRESET_CLICKED', this.handleCreateClicked);
        window.removeEventListener('TRANSMUTATION_SUCCESS', this.handleTransmuteSuccess);
        if (this.unsubscribers) this.unsubscribers.forEach(unsub => unsub());
        clearTimeout(this._consistencyTimer);
         clearTimeout(this._hydrationTimer);
        window.removeEventListener('PERSONA_DELETED',    this.integrityHandler);
        window.removeEventListener('IMPERATIVE_DELETED', this.integrityHandler);
        window.removeEventListener('ATTACHMENT_DELETED', this.integrityHandler);
        window.removeEventListener('PEER_DELETED',       this.integrityHandler);
        window.removeEventListener('INTENT_DELETED',     this.integrityHandler);
         window.removeEventListener('ARTICLE_DELETED',   this.integrityHandler);
        window.removeEventListener('METRIC_DELETED',    this.integrityHandler);
        if (this.currentDropdown && typeof this.currentDropdown.destroy === 'function') this.currentDropdown.destroy();
        if (this.expander) this.expander.destroy();
    }
 }