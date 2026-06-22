/**
 * @file components/core/Features/Archetype.js
 * @purpose UI: Archetype intelligence integration feature manager.
 * @standard Grid-based refactor with dimmed aesthetics and Geometric Seal.
 */
import { Expander } from '../../reusable/Expander.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Switcher } from '../../reusable/Switcher.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { ICONS, DEFAULT_ARCHETYPES } from '../../../utils/assets.js';
import { Editor } from '../../reusable/Editor.js';

export class Archetype {
    constructor() {
        this.items = [];
        this.isEditing = false;
        this.editingId = null;
        this.id = 'archetype'; // Standardized ID for Scheme logic

        this.init = async () => {
            await this.loadItems();
            this.refresh();
        };

        this.handleCreateClicked = () => {
            log('[LOGIC] CREATE_ARCHETYPE_SIGNAL_RECEIVED', { instance: this.id });
            this.mountEditorOverlay();
        };

        this.expander = new Expander({
            id: 'exp-archetypes',
            title: Language.text('TITLE_ARCHETYPES') || 'Archetypes',
            isDominantConfig: true,
            groupId: 'integrations-sub',
            onToggle: (isExpanded) => {
                // Signals management mode to Footer.js
                State.set('is_managing_archetypes', isExpanded);
            }
        });

        window.addEventListener('CREATE_ARCHETYPE_CLICKED', this.handleCreateClicked);
    }

    // --- Feature Interface for Scheme.js ---
    getUsedItems() {
        return this.items.filter(i => i.isActive).map(i => i.id);
    }

    useItem(id, state) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            item.isActive = state;
        }
    }
    // ---------------------------------------

    async deleteItem(id) {
        const msg = Language.text('CONFIRM_DELETE_INTEGRATION') || 'Are you sure you want to delete this integration item?';
        const confirmed = await Confirmation.show(Language.text('TITLE_DELETE') || 'Delete', msg);
        if (confirmed) {
            this.items = this.items.filter(i => i.id !== id);
            await this.saveItems();
            this.refresh();
            // [V16] Native deletion signal — drives Scheme prune + integration-dropdown cleanup.
            window.dispatchEvent(new CustomEvent('ARCHETYPE_DELETED', { detail: { type: 'archetype', id } }));
            log('DATA', 'ARCHETYPE_DELETED', { id });
        }
    }

    editItem(id) {
        this.mountEditorOverlay(id);
    }

    async saveItem(name, description) {
        if (this.editingId) {
            this.items = this.items.map(i => i.id === this.editingId ? { ...i, name, description } : i);
        } else {
            this.items.push({
                id: `arch-${Date.now()}`,
                name: name,
                description: description,
                isActive: true
            });
        }
        await this.saveItems();
        this.refresh();
    }

    mountEditorOverlay(id = null) {
        if (State.get('is_editor_active')) {
            return log('LOGIC', 'EDITOR_ALREADY_ACTIVE');
        }
        if (this.isEditing) return;
        this.isEditing = true;
        this.editingId = id;
        State.set('is_archetype_editor_active', true);

        const item = id ? this.items.find(i => i.id === id) : null;
        
        const editor = new Editor({
            caption: id ? (Language.text('TITLE_EDIT_ARCHETYPE') || 'Edit Archetype') : (Language.text('TITLE_NEW_ARCHETYPE') || 'New Archetype'),
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const nameVal = data.archName?.trim();
                const descVal = data.archDesc?.trim();
                if (nameVal && descVal) {
                    await this.saveItem(nameVal, descVal);
                } else {
                    log('UI', 'ARCHETYPE_SAVE_FAILED', { reason: 'empty_fields' });
                    throw new Error('Name and description cannot be empty');
                }
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input', {
            id: 'archName',
            placeholder: Language.text('LABEL_ARCH_NAME') || 'Archetype Name',
            value: item ? item.name : '',
            className: 'alchimist-input w-full text-sm p-3 bg-black/20 focus:outline-none',
            inputType: 'text'
        });

        editor.add('textarea', {
            id: 'archDesc',
            placeholder: Language.text('LABEL_ARCH_DESC') || 'Reasoning/Perspective Description',
            value: item ? item.description : '',
            rows: 4,
            className: 'alchimist-input w-full text-sm p-3 bg-black/20 focus:outline-none min-h-[100px] resize-y'
        });

        this.editorInstance = editor;
        editor.show();
    }

    closeEditor() {
        this.isEditing = false;
        this.editingId = null;
        this.editorInstance = null;
        State.set('is_archetype_editor_active', false);
        this.refresh();
    }

    async loadItems() {
        const stored = await Storage.get('feature_archetypes');
        if (!stored || stored.length === 0) {
            // [V16] Only re-seed defaults at genuine first run (R-1 parity with Char/Persona).
            const isInit = await Storage.get('is_initialized');
            if (!isInit) {
                this.items = JSON.parse(JSON.stringify(DEFAULT_ARCHETYPES));
                await this.saveItems();
            } else {
                this.items = [];
            }
        } else {
            this.items = stored;
        }
    }

    async saveItems() {
        if (typeof Storage.save === 'function') {
            await Storage.save('feature_archetypes', this.items);
        }
        this.updateStateIndicators();
    }

    renderList() {
        const frag = document.createDocumentFragment();
        if (this.items.length === 0) {
            frag.appendChild(dom.create('div', 'text-xs text-[var(--text-secondary)] p-2 text-center italic', { innerText: 'No archetypes defined.' }));
            return frag;
        }

        this.items.forEach(item => {
            // SP Mapping: Axiomatic Row with Grid Geometric Seal
            // Grid minmax(0, 1fr) fundamentally prevents layout blowout from massive text nodes
            const row = dom.create('div', 'grid items-center p-2 w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded transition-colors integration-row cursor-pointer group mb-1', { 
                style: 'grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem;',
                onclick: async () => {
                    item.isActive = !item.isActive;
                    await this.saveItems();
                    this.refresh();
                }
            });
            
            // Left Col: Text Wrap with internal constraint. No redundant icon.
            const left = dom.create('div', 'flex flex-col overflow-hidden min-w-0 left-col');
            const name = dom.create('div', 'text-sm text-[var(--text-primary)] font-medium truncate w-full', { innerText: item.name });
            // Dimmed description text to white/40
            const desc = dom.create('div', 'text-xs text-white/40 truncate w-full', { innerText: item.description });
            
            left.appendChild(name);
            left.appendChild(desc);

            const right = dom.create('div', 'flex items-center space-x-2 flex-shrink-0');
            
            const editBtn = dom.create('button', 'p-1 text-white/40 hover:text-[var(--color-primary)] transition-colors flex items-center justify-center', { 
                innerHTML: ICONS.EDIT || '✎',
                style: 'width: 24px; height: 24px;'
            });
            editBtn.onclick = (e) => { e.stopPropagation(); this.editItem(item.id); };
            
            const delBtn = dom.create('button', 'p-1 text-white/40 hover:text-red-500 transition-colors flex items-center justify-center', { 
                innerHTML: ICONS.TRASH || '×',
                style: 'width: 24px; height: 24px;'
            });
            delBtn.onclick = (e) => { e.stopPropagation(); this.deleteItem(item.id); };

            const switcher = new Switcher({
                initialState: item.isActive,
                onChange: async (val) => {
                    const target = this.items.find(i => i.id === item.id);
                    if (target) {
                        target.isActive = val;
                        await this.saveItems();
                    }
                }
            });
            
            const sNode = switcher.render();
            sNode.onclick = (e) => e.stopPropagation();

            right.appendChild(editBtn);
            right.appendChild(delBtn);
            right.appendChild(sNode);

            row.appendChild(left);
            row.appendChild(right);
            frag.appendChild(row);
        });
        return frag;
    }

    refresh() {
        log('UI', 'ARCHETYPE_REFRESHED', { count: this.items.length });
        if (this.listContainer) {
            this.listContainer.innerHTML = '';
            this.listContainer.appendChild(this.renderList());
        }
        this.updateStateIndicators();
    }

    getUsedItems() {
        return this.items.filter(i => i.isActive).map(i => i.id);
    }

    useItem(id, status) {
        const target = this.items.find(i => i.id === id);
        if (target) target.isActive = status;
    }

    clearUsage() {
        this.items.forEach(i => i.isActive = false);
    }

    updateStateIndicators() {
        State.set('archetypes_active_count', this.getUsedItems().length);
    }

    destroy() {
        window.removeEventListener('CREATE_ARCHETYPE_CLICKED', this.handleCreateClicked);
    }
}