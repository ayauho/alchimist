/**
 * @file components/core/Forge/Persona/Categories.js
 * @purpose UI: Persona categorization sub-orchestrator (4th persona-tools tab).
 *          Owns category CRUD, exclusive-dominant Category expanders, scoped
 *          in-category persona selection, assigning-mode lifecycle, and the
 *          persona <-> category linkage (persona.category_id).
 */
import { dom } from '../../../../utils/dom.js';
import { Expander } from '../../../reusable/Expander.js';
import { Selector } from '../../../reusable/Selector.js';
import { Item } from '../../../reusable/Item.js';
import { Confirmation } from '../../../reusable/Confirmation.js';
import { Language } from '../../../../services/Language.js';
import { Storage } from '../../../../services/Storage.js';
import { State } from '../../../../services/State.js';
import { log } from '../../../../utils/logger.js';
import { ICONS } from '../../../../utils/assets.js';
import Dropdown from '../../../reusable/Dropdown.js';

export class PersonaCategories {
    constructor(host, persona) {
        this.host = host;          // render target (the Forge persona expander.contentWrapper)
        this.persona = persona;    // live Forge/Persona instance (reuses handleSelect/applySorting/items)
        this.categories = [];
        this._expanders = {};
        // [V15.fix3] Per-category dropdown ref — prior single ref caused orphaned
        // dropdowns whenever multiple category bodies were (re)built in one pass.
        this._categoryDropdowns = {};
        this._categoryBodyEls = {};
        // [V15.fix2] Inner tools state is SCOPED to this Categories instance.
        // The outer Persona pane keeps its own this.persona.activeTab + this.persona.sortPrefs
        // — inner clicks must never write to them, otherwise the outer view re-renders
        // (which the user perceived as "click forwarding") and the outer sort pref persists
        // a value the user only meant for the in-category list.
        this._localTab = 'all';
        this._localSortPref = { key: 'created_order', order: 'ASC' };
        // [V15.fix3] Tag drill-state — scoped to this Categories instance. Mirrors the
        // shape of Persona's outer state (is_tag_persona_mode / selected_tag_label /
        // show_all_tags) so it can be passed straight through to Persona.renderTagsContainer
        // as the `state` ctx field (no code duplication — same method, scoped data).
        this._tagState = {
            is_tag_persona_mode: false,
            selected_tag_label: null,
            show_all_tags: false
        };
        this._destroyed = false;
    }

    async load() {
        const stored = await Storage.get('persona_categories');
        let list = Array.isArray(stored) ? stored : [];
        let max = list.reduce((m, c) => Math.max(m, Number(c.created_order) || 0), 0);
        let dirty = false;
        list = list.map(c => {
            if (typeof c.created_order !== 'number') { dirty = true; return { ...c, created_order: ++max }; }
            return c;
        });
        if (dirty) await this._persistCategories(list);
        this.categories = list;
        State.set('persona_categories', list);
    }

    members(catId) {
        return (this.persona.items || []).filter(p => p.category_id === catId);
    }

    async render() {
        if (this._destroyed) return;
        await this.load();
        if (this._destroyed || !this.host) return;

        // Dispose prior expander listeners before rebuild (lifecycle sovereignty).
        Object.values(this._expanders).forEach(e => { if (e && typeof e.destroy === 'function') e.destroy(); });
        this._expanders = {};
        Object.values(this._categoryDropdowns).forEach(d => { if (d && typeof d.destroy === 'function') d.destroy(); });
        this._categoryDropdowns = {};
        this._categoryBodyEls = {};

        this.host.innerHTML = '';
        const wrap = dom.create('div', 'categories-container flex flex-col gap-2 p-2');
        this.host.appendChild(wrap);
        this.wrap = wrap;

        const sorted = [...this.categories].sort((a, b) => (Number(a.created_order) || 0) - (Number(b.created_order) || 0));
        sorted.forEach(cat => wrap.appendChild(this._renderCategoryExpander(cat)));

        this.createBtn = this._renderCreateButton();
        if (this.createBtn) wrap.appendChild(this.createBtn);

        // Consume pending navigation (chip) or post-assign expand request.
        const pendingCat = this.persona._pendingCategoryExpandId;
        if (pendingCat) {
            const pendingPersona = this.persona._pendingCategoryScrollPersonaId || null;
            this.persona._pendingCategoryExpandId = null;
            this.persona._pendingCategoryScrollPersonaId = null;
            this._expandAndScroll(pendingCat, pendingPersona);
        }
        return wrap;
    }

    refresh() { if (!this._destroyed) this.render(); }

    // ---- Category expander ----
    _renderCategoryExpander(cat) {
        const wrap = dom.create('div', 'category-expander-wrap');
        const expander = new Expander({
            id: 'exp-cat-' + cat.id,
            title: cat.name,
            isExpanded: false,
            groupId: 'forge-persona-categories',   // exclusive: one open at a time
            isDominantConfig: false
        });
        this._expanders[cat.id] = expander;

        const body = dom.create('div', 'category-body flex flex-col');
        this._categoryBodyEls[cat.id] = body;
        this._buildCategoryBodyContent(body, cat);

        const node = expander.render(body);

        // Header icon-buttons (edit always; delete only when empty), injected before chevron.
        // Hidden in isolated alchemy slots — categories are browse-only there (no global
        // CRUD during transient persona selection).
        if (!this.persona.isolationKey) {
            const editBtn = dom.create('button', 'menu__item ml-1 z-10 relative', {
                innerHTML: ICONS.EDIT,
                title: Language.text('TITLE_EDIT_CATEGORY'),
                dataset: { action: 'category:edit' },
                onclick: (e) => { e.stopPropagation(); this._mountInlineEditor('edit', cat, wrap); }
            });
            if (expander.header && expander.iconEl) expander.header.insertBefore(editBtn, expander.iconEl);
            if (this.members(cat.id).length === 0) {
                const delBtn = dom.create('button', 'menu__item ml-1 z-10 relative hover:!text-red-500', {
                    innerHTML: ICONS.TRASH,
                    title: Language.text('TITLE_DELETE_CATEGORY'),
                    dataset: { action: 'category:delete' },
                    onclick: (e) => { e.stopPropagation(); this._handleDelete(cat); }
                });
                if (expander.header && expander.iconEl) expander.header.insertBefore(delBtn, expander.iconEl);
            }
        }

        wrap.appendChild(node);
        this._renderIndicators(expander, cat);

        // Assign-cover only when actively in assigning mode AND in the default Forge persona
        // context (management uses edit/delete, isolated alchemy is read-only).
        if (State.get('assigning_persona_category_mode')
            && !this.persona.isManagementMode
            && !this.persona.isolationKey) {
            this._attachAssignCover(wrap, cat);
        }
        return wrap;
    }

    // Full .persona-tools inside the category body: tabs (∞ # ❤︎ — categories tab itself omitted)
    // + sorting tools bound to a LOCAL Dropdown instance (does not touch persona.currentDropdown,
    // which keeps owning the outer Forge tools dropdown — no cross-clobber).
    _renderInCategoryTools(cat) {
        const tools = dom.create('div', 'persona-tools flex items-center h-[42px] min-h-[42px]');
        tools.setAttribute('data-tab', String(this._localTab));

        const tabsContainer = dom.create('div', 'persona-tools__tabs flex items-center h-full');
        const tabConfigs = [
            { id: 'all',       label: '∞' },
            { id: 'tags',      label: '#' },
            { id: 'favorites', label: '❤︎' }
        ];
        tabConfigs.forEach(cfg => {
            const tab = dom.create('div', `persona-tools__tab h-full flex items-center justify-center ${this._localTab === cfg.id ? 'persona-tools__tab--active' : ''}`, {
                textContent: cfg.label
            });
            tab.onclick = (e) => {
                e.stopPropagation();
                this._localTab = cfg.id;
                // Leaving '#' clears any drilled-tag state to avoid stale tag-persona-mode
                // surfacing if the user returns to '#'. Other tab transitions preserve it.
                if (cfg.id !== 'tags') {
                    this._tagState.is_tag_persona_mode = false;
                    this._tagState.selected_tag_label = null;
                }
                this._refreshAllCategoryBodies();
            };
            tabsContainer.appendChild(tab);
        });
        tools.appendChild(tabsContainer);

        tools.appendChild(this._renderInCategorySortingTools(cat));
        return tools;
    }

    _renderInCategorySortingTools(cat) {
        const pref = this._localSortPref;
        const container = dom.create('div', 'persona-sorting-tools flex items-center h-full px-1');

        const toggle = dom.create('button', 'persona-sorting__toggle bg-surface-bright border-border-subtle rounded h-8 flex items-center justify-center cursor-pointer text-base text-text-secondary hover:text-text-primary transition-colors', {
            innerHTML: pref.order === 'ASC' ? '↓' : '↑',
            title: Language.text('SORT_TOGGLE_DESC'),
            onclick: (e) => {
                e.stopPropagation();
                this._localSortPref = { ...pref, order: pref.order === 'ASC' ? 'DESC' : 'ASC' };
                this._refreshAllCategoryBodies();
            }
        });

        const options = [
            { id: 'last_used_time', label: Language.text('SORT_LAST_USED') },
            { id: 'created_order',  label: Language.text('SORT_CREATED')   },
            { id: 'used_times',     label: Language.text('SORT_USED')      },
            { id: 'ABC',            label: Language.text('SORT_ABC')       }
        ];
        Dropdown.injectStyles();
        const selectedOption = options.find(o => o.id === pref.key) || options[0];

        const existing = this._categoryDropdowns[cat.id];
        if (existing && typeof existing.destroy === 'function') existing.destroy();
        this._categoryDropdowns[cat.id] = new Dropdown(container, {
            items: options,
            placeholder: selectedOption.label,
            selectedId: pref.key,
            onSelect: (selected) => {
                const rawVal = selected?.id || selected?.value || selected;
                const matched = options.find(o => o.id === rawVal || o.label === rawVal);
                const newKey = matched ? matched.id : rawVal;
                const defaultOrders = {
                    'created_order':  'ASC',
                    'used_times':     'DESC',
                    'last_used_time': 'DESC',
                    'ABC':            'ASC'
                };
                this._localSortPref = { key: newKey, order: defaultOrders[newKey] || 'ASC' };
                // Defer to next frame: the Dropdown is still mid-callback (its panel
                // close logic runs after onSelect) and the refresh will destroy it.
                requestAnimationFrame(() => this._refreshAllCategoryBodies());
            }
        });

        container.appendChild(toggle);
        return container;
    }

    // Surgical refresh of a single category body. Kept for callers that only need to
    // rebuild one body. Internally delegates to _buildCategoryBodyContent so the tab
    // branching ('#' -> tags view, otherwise -> member list) stays in one place.
    _refreshCategoryBody(cat) {
        const bodyEl = this._categoryBodyEls[cat.id];
        if (!bodyEl) return;
        bodyEl.innerHTML = '';
        this._buildCategoryBodyContent(bodyEl, cat);
    }

    // Refresh every category body — needed when shared state (_localTab, _localSortPref,
    // _tagState, favorites) changes, so all categories show consistent inner-tools state
    // even after the user later expands a different category.
    _refreshAllCategoryBodies() {
        if (this._destroyed) return;
        Object.entries(this._categoryBodyEls).forEach(([catId, bodyEl]) => {
            if (!bodyEl) return;
            const cat = this.categories.find(c => c.id === catId);
            if (cat) {
                bodyEl.innerHTML = '';
                this._buildCategoryBodyContent(bodyEl, cat);
            }
        });
    }

    // Single source of truth for category body composition. Tools row + either the
    // scoped tags view ('#' tab) or the scoped member list (any other tab).
    _buildCategoryBodyContent(body, cat) {
        body.appendChild(this._renderInCategoryTools(cat));
        if (this._localTab === 'tags') {
            const tagsWrapper = dom.create('div', 'in-category-tags-wrapper');
            body.appendChild(tagsWrapper);
            this._renderTagsView(tagsWrapper, cat);
        } else {
            const content = dom.create('div', 'expandable-content');
            body.appendChild(content);
            this._renderMemberList(content, cat);
        }
    }

    // [V15.fix3] Reuses the EXACT same Persona.renderTagsContainer code path as the outer
    // pane — only the ctx (personas / state / handlers / sortFn / itemConstructor) is scoped
    // to this category. No tag UI logic is duplicated here.
    _renderTagsView(wrapper, cat) {
        const members = this.members(cat.id);
        const isMgmt = this.persona.isManagementMode;
        this.persona.renderTagsContainer(wrapper, {
            personas: members,
            state: this._tagState,
            isManagement: isMgmt,
            activeId: isMgmt ? null : this.persona.activeId,
            onTagClick: (label) => {
                this._tagState.is_tag_persona_mode = true;
                this._tagState.selected_tag_label = label;
                this._refreshAllCategoryBodies();
            },
            onExitTagMode: () => {
                this._tagState.is_tag_persona_mode = false;
                this._tagState.selected_tag_label = null;
                this._refreshAllCategoryBodies();
            },
            refreshFn: () => this._refreshAllCategoryBodies(),
            sortFn: (items) => this._applyLocalSort(items),
            onSelect: (item, isReSelect) => {
                if (isMgmt) this.persona.handleEdit(item);
                else this.persona.handleSelect(item, isReSelect);
            },
            itemConstructor: this._buildPersonaItemConstructor(cat)
        });
    }

    _renderMemberList(content, cat) {
        // Apply LOCAL tab filter (∞=all, ❤︎=favorited members, #=members with any tag),
        // then LOCAL sort (this._localSortPref) — fully decoupled from persona.sortPrefs.
        let members = this.members(cat.id);
        const isMgmt = this.persona.isManagementMode;
        if (this._localTab === 'favorites') {
            const favs = State.get('favorite_personas') || [];
            members = members.filter(p => favs.includes(p.id));
        } else if (this._localTab === 'tags') {
            members = members.filter(p => Array.isArray(p.tags) && p.tags.length > 0);
        }
        members = this._applyLocalSort(members);
        const selector = new Selector({
            items: members,
            activeId: isMgmt ? null : this.persona.activeId,
            onSelect: (item, isReSelect) => {
                if (isMgmt) this.persona.handleEdit(item);
                else this.persona.handleSelect(item, isReSelect);
            },
            itemConstructor: this._buildPersonaItemConstructor(cat)
        });
        content.appendChild(selector.render({ hasTools: false }));
    }

    // Single source of truth for persona-item rendering inside category bodies AND the
    // scoped tags view. Returns mode-appropriate actions/itemOpts:
    //   • management → edit/delete actions; no favorite/category affordances (parity with
    //     the outer management persona list).
    //   • isolated alchemy slot → favorite heart only; no unassign-category (selection-only).
    //   • default Forge → favorite + unassign-category.
    _buildPersonaItemConstructor(cat) {
        return {
            render: (item, isActive, onSelect, selectorOpts) => {
                const isMgmt = this.persona.isManagementMode;
                const isIsolated = !!this.persona.isolationKey;
                let actions = null;
                let itemOpts = { ...selectorOpts };

                if (isMgmt) {
                    actions = {
                        onEdit: () => this.persona.handleEdit(item),
                        onDelete: () => this.persona.handleDelete(item)
                    };
                } else {
                    itemOpts.isFavorite = (State.get('favorite_personas') || []).includes(item.id);
                    itemOpts.onFavoriteToggle = async (id) => {
                        const targetId = id || item.id;
                        const favs = State.get('favorite_personas') || [];
                        const next = favs.includes(targetId) ? favs.filter(f => f !== targetId) : [...favs, targetId];
                        State.set('favorite_personas', next);
                        await Storage.set({ favorite_personas: next });
                        this._refreshAllCategoryBodies();
                    };
                    if (!isIsolated) {
                        itemOpts.onUnassignCategory = (id) => this._handleUnassign(id || item.id, cat);
                    }
                }

                return Item.render(item, isActive, onSelect, actions, itemOpts);
            }
        };
    }    

    _applyLocalSort(items) {
        const { key, order } = this._localSortPref;
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
            if (result === 0) return (Number(a.created_order) || 0) - (Number(b.created_order) || 0);
            return result * multiplier;
        });
    }

    // ---- Indicators (single-row, +N overflow) ----
    _renderIndicators(expander, cat) {
        const members = this.members(cat.id);
        if (!members.length) { expander.updateSubtitleHTML(''); return; }
        const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        // Mirror Preset.gatherCurrentState truncation contract: substring(0, 15) + UPPERCASE
        // (uppercase BEFORE escape so escaped entities like &amp; don't become &AMP;).
        const short = (s) => (typeof s === 'string' ? s.substring(0, 15) : '');
        const style = 'color: var(--color-persona, #a78bfa); border: 1px solid rgba(167,139,250,0.3);';
        const badges = members.map(p => `<span class="protocol-indicator" style="${style}">@${esc(short(p.name).toUpperCase())}</span>`).join('');
        expander.updateSubtitleHTML(`<span class="category-indicator-row">${badges}</span>`);
        requestAnimationFrame(() => {
            const row = expander.subtitleEl && expander.subtitleEl.querySelector('.category-indicator-row');
            if (row) this._fitIndicators(row, members.length, style);
        });
    }

    _fitIndicators(row, total, style) {
        const max = row.clientWidth;
        if (max <= 0) return;
        const kids = Array.from(row.children);
        let used = 0, shown = 0;
        const reserve = 34; // space for the +N pseudo-indicator
        for (let i = 0; i < kids.length; i++) {
            const w = kids[i].offsetWidth + 4;
            const needReserve = (i < kids.length - 1) ? reserve : 0;
            if (used + w + needReserve > max) break;
            used += w; shown++;
        }
        if (shown >= total) return;
        for (let i = shown; i < kids.length; i++) kids[i].style.display = 'none';
        const more = document.createElement('span');
        more.className = 'protocol-indicator';
        more.style.cssText = style;
        more.textContent = `+${total - shown}`;
        row.appendChild(more);
    }

    // ---- Create button + inline editor ----
    _renderCreateButton() {
        // No category CRUD inside alchemy isolated slots (read-only browse during selection).
        if (this.persona.isolationKey) return null;
        return dom.create('button', 'category-create-btn w-full text-xs font-mono border border-border-subtle rounded px-3 py-2 text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center gap-1', {
            innerText: Language.text('BTN_CREATE_CATEGORY'),
            dataset: { action: 'category:create' },
            onclick: (e) => { this._mountInlineEditor('create', null, e.currentTarget); }
        });
    }

    _mountInlineEditor(mode, cat, anchorNode) {
        const editor = dom.create('div', 'category-inline-editor flex flex-col gap-2 w-full p-2 border border-border-subtle rounded');
        const input = dom.create('input', 'alchimist-input w-full text-sm p-2 bg-black/20 focus:outline-none rounded', {
            type: 'text',
            placeholder: Language.text('PLACEHOLDER_CATEGORY_NAME'),
            value: cat ? cat.name : ''
        });
        const group = dom.create('div', 'pe-btn-group');
        const cancel = dom.create('button', 'pe-btn pe-btn--secondary', {
            innerText: Language.text('BTN_CANCEL'),
            onclick: () => this.refresh()
        });
        const confirm = dom.create('button', 'pe-btn pe-btn--primary', {
            innerText: mode === 'create' ? Language.text('BTN_CREATE') : Language.text('BTN_SAVE'),
            onclick: async () => {
                const name = (input.value || '').trim();
                if (!name) { input.focus(); return; }
                if (mode === 'create') await this._createCategory(name);
                else await this._renameCategory(cat.id, name);
            }
        });
        group.appendChild(cancel);
        group.appendChild(confirm);
        editor.appendChild(input);
        editor.appendChild(group);
        anchorNode.replaceWith(editor);
        input.focus();
    }

    // ---- Mutations (own Storage commit + broadcast: integrity cascade ownership) ----
    async _createCategory(name) {
        const max = this.categories.reduce((m, c) => Math.max(m, Number(c.created_order) || 0), 0);
        const id = 'cat_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2));
        const next = [...this.categories, { id, name, created_order: max + 1 }];
        await this._persistCategories(next);
        log('DATA', ['CATEGORY', 'CREATE'], { id, name });
        this.refresh();
    }

    async _renameCategory(id, name) {
        const next = this.categories.map(c => c.id === id ? { ...c, name } : c);
        await this._persistCategories(next);
        log('DATA', ['CATEGORY', 'RENAME'], { id });
        this.refresh();
    }

    async _handleDelete(cat) {
        if (this.members(cat.id).length > 0) return;
        const ok = await Confirmation.show(Language.text('TITLE_DELETE_CATEGORY'), Language.text('CONFIRM_DELETE_CATEGORY'));
        if (!ok) return;
        const next = this.categories.filter(c => c.id !== cat.id);
        await this._persistCategories(next);
        window.dispatchEvent(new CustomEvent('CATEGORY_DELETED', { detail: { type: 'category', id: cat.id } }));
        log('DATA', ['CATEGORY', 'DELETE'], { id: cat.id });
        this.refresh();
    }

    _handleUnassign(personaId, cat) {
        const personas = (this.persona.items || []).map(p => p.id === personaId ? { ...p, category_id: null } : p);
        this._persistPersonas(personas);
        log('DATA', ['CATEGORY', 'UNASSIGN'], { persona: personaId, category: cat.id });
        this.refresh();
    }

    _commitAssign(cat) {
        const personaId = State.get('assigning_persona_category_id');
        if (!personaId) return;
        const personas = (this.persona.items || []).map(p => p.id === personaId ? { ...p, category_id: cat.id } : p);
        this._persistPersonas(personas);
        State.set('assigning_persona_category_mode', false);
        State.set('assigning_persona_category_id', null);
        log('DATA', ['CATEGORY', 'ASSIGN'], { persona: personaId, category: cat.id });
        // PERSONA_DATA_UPDATED intentionally NOT dispatched here: it would trigger
        // Persona.recalculateTagMetadata (heavy O(personas × tags) walk + tags_registry
        // Storage compression) and Persona.loadSortPrefs (Storage round-trip), neither
        // of which is affected by a category assignment. Saves ~hundreds of ms per assign.
        this.persona._pendingCategoryExpandId = cat.id;
        this.persona._pendingCategoryScrollPersonaId = personaId;
        this.refresh();
    }

    _attachAssignCover(wrap, cat) {
        const cover = dom.create('div', 'category-assign-cover');
        const btn = dom.create('button', 'category-assign-cover__btn', {
            innerText: Language.text('BTN_ASSIGN'),
            dataset: { action: 'category:assign-commit' },
            onclick: (e) => { e.stopPropagation(); this._commitAssign(cat); }
        });
        cover.appendChild(btn);
        wrap.appendChild(cover);
    }

    _expandAndScroll(catId, personaId) {
        const expander = this._expanders[catId];
        if (!expander) return;
        if (!expander.isExpanded) expander.expand();
        if (!personaId) {
            const scroller = this.host.closest('.expandable-body') || this.host;
            if (scroller) scroller.scrollTop = 0;
            return;
        }
        setTimeout(() => {
            const exp = this._expanders[catId];
            const bodyEl = exp && exp.body;
            const item = bodyEl && bodyEl.querySelector(`#persona-${personaId}`);
            if (item && item.scrollIntoView) item.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 60);
    }

    // ---- Persistence helpers ----
    async _persistCategories(list) {
        this.categories = list;
        State.set('persona_categories', list);
        await Storage.set({ persona_categories: list });
    }

    _persistPersonas(personas) {
        this.persona.items = personas;
        // State.update bypasses the heavy double-stringify equality check that State.set
        // would perform on the ~700KB personas array, AND skips the debounced auto-persist
        // that 'personas' (a _configKey) would otherwise schedule — the explicit Storage.set
        // below is the single authoritative write.
        State.update({ personas });
        // Fire-and-forget: LZMA compression of the personas array runs in the background
        // (it's the dominant cost — ~1–2s on large rosters). The UI updates instantly
        // because this.persona.items + State are already mutated synchronously above.
        Storage.set({ personas }).catch(err => log('e', 'CATEGORY_PERSIST_FAIL', err));
    }

    destroy() {
        this._destroyed = true;
        Object.values(this._expanders || {}).forEach(e => { if (e && typeof e.destroy === 'function') e.destroy(); });
        this._expanders = {};
        Object.values(this._categoryDropdowns || {}).forEach(d => { if (d && typeof d.destroy === 'function') d.destroy(); });
        this._categoryDropdowns = {};
    }
}
