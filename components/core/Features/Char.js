/**
 * @file components/core/Features/Char.js
 * @purpose UI: Character intelligence integration feature manager.
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
import { ICONS, DEFAULT_CHARS } from '../../../utils/assets.js';
import { Editor } from '../../reusable/Editor.js';

export class Char {
    constructor() {
        this.items = [];
        this.isEditing = false;
        this.editingId = null;
        this.id = 'char'; // Standardized ID for Scheme logic

        this.init = async () => {
            await this.loadItems();
            this.refresh();
        };

        this.handleCreateClicked = () => {
            log('[LOGIC] CREATE_CHAR_SIGNAL_RECEIVED', { instance: this.id });
            this.mountEditorOverlay();
        };

        this.expander = new Expander({
            id: 'exp-chars',
            title: Language.text('TITLE_CHARS') || 'Characters',
            isDominantConfig: true,
            groupId: 'integrations-sub',
            onToggle: (isExpanded) => {
                // Signals management mode to Footer.js
                State.set('is_managing_chars', isExpanded);
            }
        });

        window.addEventListener('CREATE_CHAR_CLICKED', this.handleCreateClicked);
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

    async saveItems() {
        if (typeof Storage.save === 'function') {
            await Storage.save('feature_chars', this.items);
        }
        this.updateStateIndicators();
    }

    updateStateIndicators() {
        State.set('chars_active_count', this.getUsedItems().length);
    }

    async deleteItem(id) {
        const msg = Language.text('CONFIRM_DELETE_INTEGRATION') || 'Are you sure you want to delete this integration item?';
        const confirmed = await Confirmation.show(Language.text('TITLE_DELETE') || 'Delete', msg);
        if (confirmed) {
            this.items = this.items.filter(i => i.id !== id);
            await this.saveItems();
            this.refresh();
            // [V16] Native deletion signal — drives Scheme prune + integration-dropdown cleanup.
            window.dispatchEvent(new CustomEvent('CHAR_DELETED', { detail: { type: 'char', id } }));
            log('DATA', 'CHAR_DELETED', { id });
        }
    }

    editItem(id) {
        this.mountEditorOverlay(id);
    }

    async saveItem(name) {
        if (this.editingId) {
            this.items = this.items.map(i => i.id === this.editingId ? { ...i, name } : i);
        } else {
            this.items.push({
                id: `char-${Date.now()}`,
                name: name,
                isActive: true
            });
        }
        await this.saveItems();
        this.refresh();
    }

    mountEditorOverlay(id = null) {
        if (State.get('is_editor_active')) return;
        this.isEditing = true;
        this.editingId = id;
        State.set('is_char_editor_active', true);

        const item = id ? this.items.find(i => i.id === id) : null;
        
        const editor = new Editor({
            caption: id ? (Language.text('TITLE_EDIT_CHAR') || 'Edit Character') : (Language.text('TITLE_NEW_CHAR') || 'New Character'),
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const val = data.charName?.trim();
                if (val) {
                    await this.saveItem(val);
                } else {
                    throw new Error('Character name cannot be empty');
                }
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input', {
            id: 'charName',
            placeholder: Language.text('LABEL_CHAR_NAME') || 'Character Name',
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
        State.set('is_char_editor_active', false);
        this.refresh();
    }

    async loadItems() {
        const stored = await Storage.get('feature_chars');
        if (!stored || stored.length === 0) {
            // [V16] Only re-seed defaults at genuine first run. After a bundle revoke that empties
            // feature_chars, respect the empty state instead of resurrecting the removed defaults.
            const isInit = await Storage.get('is_initialized');
            if (!isInit) {
                this.items = JSON.parse(JSON.stringify(DEFAULT_CHARS));
                await this.saveItems();
            } else {
                this.items = [];
            }
        } else {
            this.items = stored;
        }
    }

    renderList() {
        const frag = document.createDocumentFragment();
        if (this.items.length === 0) {
            frag.appendChild(dom.create('div', 'text-xs text-[var(--text-secondary)] p-2 text-center italic', { innerText: 'No characters defined.' }));
            return frag;
        }
        this.items.forEach(item => {
            const row = dom.create('div', 'grid items-center p-2 w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded transition-colors integration-row cursor-pointer group mb-1', { 
                style: 'grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem;',
                onclick: async () => {
                    item.isActive = !item.isActive;
                    log('UI', 'INTEGRATION_ROW_TOGGLE', { id: item.id, active: item.isActive });
                    await this.saveItems();
                    this.refresh();
                }
            });
            
            const left = dom.create('div', 'flex items-center overflow-hidden min-w-0 left-col');
            const name = dom.create('div', 'text-sm text-[var(--text-primary)] font-medium truncate w-full', { innerText: item.name });
            left.appendChild(name);

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
                    item.isActive = val;
                    await this.saveItems();
                    this.refresh();
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
        log('UI', 'CHAR_REFRESHED', { count: this.items.length });
        if (this.listContainer) {
            this.listContainer.innerHTML = '';
            this.listContainer.appendChild(this.renderList());
        }
        this.updateStateIndicators();
    }

    destroy() {
        window.removeEventListener('CREATE_CHAR_CLICKED', this.handleCreateClicked);
    }
}