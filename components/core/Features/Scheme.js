/**
 * @file components/core/Features/Scheme.js
 * @purpose UI/Logic: Universal Scheme manager for Integration instances.
 * @standard Grid-based refactor with dimmed aesthetics and Deep Sync Deactivation.
 */
import { Expander } from '../../reusable/Expander.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Switcher } from '../../reusable/Switcher.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { ICONS } from '../../../utils/assets.js';
import { Editor } from '../../reusable/Editor.js';

export class Scheme {
    constructor(instances = []) {
        this.instances = instances; // Array of managed features (e.g., Char, Archetype)
        this.items = [];
        this.isEditing = false;
        this.editingId = null;
        this.id = 'scheme';

        // [V13.S³] Consistency Engine: Subscription Matrix
        this.unsubscribers = [];
        const debouncedCheck = () => {
            clearTimeout(this._consistencyTimer);
            this._consistencyTimer = setTimeout(() => this.checkConsistency(), 100);
        };

        // Watch managed feature instances for state changes
        this.unsubscribers.push(State.subscribe('chars_active_count', debouncedCheck));
        this.unsubscribers.push(State.subscribe('archetypes_active_count', debouncedCheck));

        // [V16] Member-deletion cascade: prune deleted char/archetype ids out of saved scheme
        // snapshots; auto-remove any scheme left with zero members.
        this._memberDeletedHandler = (e) => this._handleMemberDeleted(e.detail);
        window.addEventListener('CHAR_DELETED',      this._memberDeletedHandler);
        window.addEventListener('ARCHETYPE_DELETED', this._memberDeletedHandler);

        this.handleCreateClicked = () => {
            log('[LOGIC] CREATE_SCHEME_SIGNAL_RECEIVED', { instance: this.id });
            this.mountEditorOverlay();
        };

        this.expander = new Expander({
            id: 'exp-schemes',
            title: Language.text('TITLE_SCHEMES') || 'Schemes',
            isDominantConfig: true,
            groupId: 'integrations-sub',
            onToggle: (isExpanded) => {
                State.set('is_managing_schemes', isExpanded);
            }
        });

        window.addEventListener('CREATE_SCHEME_CLICKED', this.handleCreateClicked);
    }

    async initialize() {
        await this.loadItems();
        this.refresh();
        await this.checkConsistency();
    }

    async loadItems() {
        const stored = await Storage.get('feature_schemes');
        this.items = stored || [];
        State.set('schemes', this.items);
    }

    async saveItems() {
        if (typeof Storage.save === 'function') {
            await Storage.save('feature_schemes', this.items);
        }
        State.set('schemes', this.items);
        this.updateStateIndicators();
    }

    updateStateIndicators() {
        const activeId = State.get('active_scheme_id');
        const activeItem = this.items.find(i => i.id === activeId);
        State.set('schemes_active_count', activeItem ? 1 : 0);
        if (this.expander) {
            this.expander.updateSubtitle(activeItem ? activeItem.name : null);
        }
    }

    async checkConsistency() {
        // (unchanged)
        const current = this.generateSnapshot();
        
        const matchedScheme = this.items.find(p => {
            const s = p.snapshot;
            if (!s) return false;
            return Object.keys(current).every(key => {
                const idsA = (s[key] || []).sort().join(',');
                const idsB = (current[key] || []).sort().join(',');
                return idsA === idsB;
            });
        });

        const newActiveId = matchedScheme ? matchedScheme.id : null;
        if (State.get('active_scheme_id') !== newActiveId) {
            State.set('active_scheme_id', newActiveId);
            this.refresh();
        }
    }

    // [V16] Strip a deleted member id from every scheme snapshot; remove zero-member schemes.
    async _handleMemberDeleted({ id } = {}) {
        if (!id || !Array.isArray(this.items) || this.items.length === 0) return;
        let modified = false;
        const survivors = [];
        for (const scheme of this.items) {
            const snap = scheme.snapshot || {};
            let touched = false;
            for (const key of Object.keys(snap)) {
                if (Array.isArray(snap[key]) && snap[key].includes(id)) {
                    snap[key] = snap[key].filter(x => x !== id);
                    touched = true; modified = true;
                }
            }
            const totalMembers = Object.keys(snap).reduce((n, k) => n + (Array.isArray(snap[k]) ? snap[k].length : 0), 0);
            if (totalMembers === 0) {
                if (State.get('active_scheme_id') === scheme.id) State.set('active_scheme_id', null);
                modified = true;
                log('LOGIC', 'SCHEME_AUTO_PRUNED', { id: scheme.id });
                continue; // drop scheme
            }
            if (touched) scheme.snapshot = snap;
            survivors.push(scheme);
        }
        if (modified) {
            this.items = survivors;
            await this.saveItems();
            await this.checkConsistency();
            this.refresh();
        }
    }

    generateSnapshot() {
        const data = {};
        for (const inst of this.instances) {
            data[inst.id] = inst.getUsedItems();
        }
        return data;
    }

    async restoreScheme(snapshot) {
        for (const inst of this.instances) {
            inst.clearUsage();
            const active_ids = snapshot[inst.id] || [];
            for (const item_id of active_ids) {
                inst.useItem(item_id, true);
            }
            await inst.saveItems();
            if (inst.refresh) inst.refresh();
        }
        log('LOGIC', 'SCHEME_RESTORED', { snapshot });
    }

    async saveScheme(name) {
        const snapshot = this.generateSnapshot();
        if (this.editingId) {
            const item = this.items.find(i => i.id === this.editingId);
            if (item) {
                item.name = name;
                item.snapshot = snapshot; 
            }
        } else {
            this.items.push({
                id: `scheme-${Date.now()}`,
                name: name,
                snapshot: snapshot
            });
        }
        await this.saveItems();
        await this.checkConsistency();
    }

    async deleteItem(id) {
        const msg = Language.text('CONFIRM_DELETE_INTEGRATION') || 'Are you sure you want to delete this integration item?';
        const confirmed = await Confirmation.show(Language.text('TITLE_DELETE') || 'Delete', msg);
        if (confirmed) {
            this.items = this.items.filter(i => i.id !== id);
            await this.saveItems();
            if (State.get('active_scheme_id') === id) State.set('active_scheme_id', null);
            this.refresh();
            log('UI', 'SCHEME_DELETED', { id });
        }
    }

    editItem(id) {
        this.mountEditorOverlay(this.items.find(i => i.id === id));
    }

    mountEditorOverlay(item = null) {
        if (State.get('is_editor_active')) return;
        this.isEditing = true;
        this.editingId = item ? item.id : null;
        State.set('is_scheme_editor_active', true);

        const editor = new Editor({
            caption: item ? 'EDIT SCHEME' : 'NEW SCHEME',
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const val = data.schemeName?.trim();
                if (val) {
                    await this.saveScheme(val);
                } else {
                    throw new Error('Scheme name cannot be empty');
                }
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input', {
            id: 'schemeName',
            placeholder: Language.text('LABEL_SCHEME_NAME') || 'Scheme Name',
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
        State.set('is_scheme_editor_active', false);
        this.refresh();
    }

    _renderSnapshotIndicators(snapshot) {
        if (!snapshot) return null;
        
        const container = dom.create('div', 'flex flex-wrap items-center gap-1 mt-1');
        let hasBadges = false;

        this.instances.forEach(inst => {
            const activeIds = snapshot[inst.id] || [];
            activeIds.forEach(itemId => {
                const featureItem = inst.items.find(i => i.id === itemId);
                if (!featureItem) return;

                const parts = (featureItem.name || '').trim().split(/\s+/);
                let abbrev = parts[0] || '';
                if (inst.id === 'archetype' && parts.length > 1) {
                    abbrev = `${parts[0]} ${parts[1][0]}.`;
                }

                if (!abbrev) return;
                hasBadges = true;

                const badge = dom.create('span', 'font-mono uppercase', { innerText: abbrev });
                if (inst.id === 'char') {
                    badge.style.cssText = 'background-color: #fff !important; color: #000 !important; padding: 1px 3px; font-size: 8px; line-height: 8px; border-radius: 2px; display: inline-block; border: none;';
                } else {
                    badge.style.cssText = 'border: 1px solid var(--text-secondary); background: rgba(255,255,255,0.05); color: var(--text-primary); padding: 0px 3px; font-size: 8px; line-height: 8px; border-radius: 2px; display: inline-block;';
                }
                container.appendChild(badge);
            });
        });

        return hasBadges ? container : null;
    }

    renderList() {
        const activeSchemeId = State.get('active_scheme_id');
        const frag = document.createDocumentFragment();
        if (this.items.length === 0) {
            frag.appendChild(dom.create('div', 'text-xs text-[var(--text-secondary)] p-2', { innerText: 'No schemes saved.' }));
            return frag;
        }
        this.items.forEach(item => {
            const isActive = item.id === activeSchemeId;
            const row = dom.create('div', 'grid items-center p-2 w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded transition-colors integration-row cursor-pointer group mb-1', { 
                style: 'grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.75rem;',
                onclick: async () => {
                    if (!isActive) {
                        // Activation Path: Restore specific snapshots
                        await this.restoreScheme(item.snapshot);
                        State.set('active_scheme_id', item.id);
                    } else {
                        /**
                         * [V13.S³] Deep Sync Deactivation Path
                         * Ensure that clicking an already active scheme performs a full reset 
                         * across memory, persistent storage, and sub-module UI.
                         */
                        for (const inst of this.instances) {
                            inst.clearUsage(); // Memory reset
                            await inst.saveItems(); // Persistence & State Count sync
                            if (inst.refresh) inst.refresh(); // Visual switcher sync
                        }
                        State.set('active_scheme_id', null);
                    }
                    this.refresh();
                }
            });
            
            const left = dom.create('div', 'flex-shrink-0 flex items-center justify-center');
            left.innerHTML = `<div class="radio-indicator w-3 h-3 rounded-full border border-white/20 ${isActive ? 'bg-white/80 border-white' : ''}"></div>`;

            const mid = dom.create('div', 'flex flex-col justify-center overflow-hidden min-w-0 left-col');
            const name = dom.create('div', 'text-sm text-[var(--text-primary)] font-medium truncate w-full', { innerText: item.name });
            mid.appendChild(name);

            if (item.snapshot) {
                const indicators = this._renderSnapshotIndicators(item.snapshot);
                if (indicators) mid.appendChild(indicators);
            }

            const right = dom.create('div', 'flex items-center space-x-2 flex-shrink-0');
            const editBtn = dom.create('button', 'p-1 text-white/40 hover:text-[var(--color-primary)] transition-colors', { 
                innerHTML: ICONS.EDIT || '✎',
                title: 'Edit'
            });
            editBtn.onclick = (e) => { e.stopPropagation(); this.editItem(item.id); };
            const delBtn = dom.create('button', 'p-1 text-white/40 hover:text-red-500 transition-colors', { 
                innerHTML: ICONS.TRASH || '×',
                title: 'Delete'
            });
            delBtn.onclick = (e) => { e.stopPropagation(); this.deleteItem(item.id); };

            right.appendChild(editBtn);
            right.appendChild(delBtn);

            row.appendChild(left);
            row.appendChild(mid);
            row.appendChild(right);
            frag.appendChild(row);
        });
        return frag;
    }

    refresh() {
        log('UI', 'SCHEME_REFRESHED', { count: this.items.length });
        if (this.listContainer) {
            this.listContainer.innerHTML = '';
            this.listContainer.appendChild(this.renderList());
        }
        this.updateStateIndicators();
    }

    destroy() {
        window.removeEventListener('CREATE_SCHEME_CLICKED', this.handleCreateClicked);
        window.removeEventListener('CHAR_DELETED',      this._memberDeletedHandler);
        window.removeEventListener('ARCHETYPE_DELETED', this._memberDeletedHandler);
        if (this.unsubscribers) this.unsubscribers.forEach(unsub => unsub());
        clearTimeout(this._consistencyTimer);
    }
}