/**
 * @file components/core/Forge/Imperative.js
 * @purpose UI: Permanent mandatory instructions manager.
 */
import { Expander } from '../../reusable/Expander.js';
import { Switcher } from '../../reusable/Switcher.js';
import { dom } from '../../../utils/dom.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { ICONS } from '../../../utils/assets.js';
import { Editor } from '../../reusable/Editor.js';

export class Imperative {
    constructor(container) {
        this.container = container;
        this.items = [];
        this.isEditing = false;
        this.editingId = null;

        // Bind to allow removal
        this.handleCreateClicked = () => {
            log('[LOGIC] CREATE_IMPERATIVE_SIGNAL_RECEIVED', { instance: this.id });
            this.mountEditorOverlay();
        };

        this.expander = new Expander({
            id: 'exp-imperative',
            title: Language.text('TITLE_IMPERATIVES') || 'Imperatives',
            isDominantConfig: true,
            groupId: 'forge-main',
            onToggle: (isExpanded) => {
                State.set('is_managing_imperatives', isExpanded);
            }
        });

        window.addEventListener('CREATE_IMPERATIVE_CLICKED', this.handleCreateClicked);

        this.handlePresetApplied = async () => {
            this.items = (await Storage.get('imperatives')) || [];
            if (this.expander && this.expander.body) this.refresh();
        };
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.addEventListener('TREASURY_RESTORED', this.handlePresetApplied);

        log('[LIFECYCLE] IMPERATIVE_INSTANCE_CREATED', { containerId: container.id });
    }

    destroy() {
        window.removeEventListener('CREATE_IMPERATIVE_CLICKED', this.handleCreateClicked);
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.removeEventListener('TREASURY_RESTORED', this.handlePresetApplied);
        log('[LIFECYCLE] IMPERATIVE_INSTANCE_DESTROYED');
    }

    async render() {
        const stored = await Storage.get('imperatives');
        this.items = stored || [];
        State.set('imperatives', this.items);

        const content = dom.create('div', 'p-3 flex flex-col gap-3 min-h-[300px]');
        
        content.appendChild(this.renderList());

        const node = this.expander.render(content);
        this.container.appendChild(node);
        this.refreshHeader();
    }

    renderList() {
        const wrapper = dom.create('div', 'flex flex-col gap-2');
        
        if (this.items.length === 0) {
            wrapper.appendChild(dom.create('div', 'text-text-secondary text-xs italic text-center py-10', {
                innerText: 'No imperatives defined.'
            }));
        }

        this.items.forEach(item => {
            const row = dom.create('div', 'flex items-center justify-between gap-3 p-2 bg-white/5 rounded border border-white/10 group cursor-pointer hover:bg-white/10', {
                onclick: () => this.startEdit(item)
            });
            
            // Left Section: Truncated Text
            const contentContainer = dom.create('div', 'flex-1 overflow-hidden min-w-0');
            const text = dom.create('div', 'text-xs text-text-secondary line-clamp-2 leading-tight u-break-anywhere', {
                innerText: item.text
            });
            contentContainer.appendChild(text);

            // Right Section: Controls
            const actionsContainer = dom.create('div', 'flex items-center gap-2 flex-shrink-0');
            
            const editBtn = dom.create('button', 'p-1 hover:text-accent transition-colors', {
                innerHTML: ICONS.EDIT,
                onclick: (e) => { e.stopPropagation(); this.startEdit(item); }
            });
            
            const delBtn = dom.create('button', 'p-1 hover:text-red-500 transition-colors', {
                innerHTML: ICONS.TRASH,
                onclick: (e) => { e.stopPropagation(); this.deleteItem(item.id); }
            });

            const switcher = new Switcher({
                initialState: item.active,
                onChange: (val) => this.toggleActive(item.id, val)
            });
            const switcherNode = switcher.render();
            switcherNode.onclick = (e) => e.stopPropagation();

            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(delBtn);
            actionsContainer.appendChild(switcherNode);

            row.appendChild(contentContainer);
            row.appendChild(actionsContainer);
            wrapper.appendChild(row);
        });

        return wrapper;
    }

    refreshHeader() {
        if (!this.expander) return;
        
        const activeItems = this.items.filter(item => item.active);
        const indicators = activeItems.map(item => {
            const words = item.text.trim().split(/\s+/);
            const firstWord = words[0] || '...';
            return {
                abbrev: firstWord,
                color: 'rgba(255, 255, 255, 0.4)',
                className: 'bg-white/10 !rounded-none',
                padding: '2px 4px 1px'
            };
        });

        if (typeof this.expander.updateIndicators === 'function') {
            this.expander.updateIndicators(indicators);
        }
    }

    async saveItem(text) {
        if (this.editingId) {
            this.items = this.items.map(i => i.id === this.editingId ? { ...i, text } : i);
        } else {
            this.items.push({
                id: `imp-${Date.now()}`,
                text,
                active: true,
                used: true
            });
        }
        log('DATA', 'STORAGE_COMMIT_INITIATED', { action: 'save', items: this.items.length });
        State.set('imperatives', this.items);
        await Storage.set({ imperatives: this.items });
        this.refresh();
    }

    async deleteItem(id) {
        const confirmed = await Confirmation.show(
            Language.text('TITLE_DELETE_IMPERATIVE') || 'Delete Imperative',
            Language.text('MSG_CONFIRM_DELETE_IMPERATIVE') || 'Are you sure you want to delete this mandatory instruction?'
        );
        if (confirmed) {
            this.items = this.items.filter(i => i.id !== id);
            log('DATA', 'STORAGE_COMMIT_INITIATED', { action: 'delete', id });
            State.set('imperatives', this.items);
            await Storage.set({ imperatives: this.items }); // FIX: Persistence added
            window.dispatchEvent(new CustomEvent('IMPERATIVE_DELETED', { detail: { type: 'imperative', id } }));
            this.refresh();
        }
    }

    async toggleActive(id, val) {
        log('DATA', 'IMPERATIVE_STATE_MUTATED', { id, active: val });
        this.items = this.items.map(i => i.id === id ? { ...i, active: val, used: val } : i);
        State.set('imperatives', this.items);
        await Storage.set({ imperatives: this.items });
        this.refreshHeader();
    }

    startEdit(item) {
        this.mountEditorOverlay(item);
    }

    mountEditorOverlay(item = null) {
        this.isEditing = true;
        this.editingId = item ? item.id : null;
        State.set('is_imperative_editor_active', true);

        const editor = new Editor({
            caption: item ? 'EDIT IMPERATIVE' : 'CREATE IMPERATIVE',
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                const val = data.imperativeText?.trim();
                if (val) {
                    await this.saveItem(val);
                } else {
                    throw new Error('Instruction cannot be empty');
                }
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('textarea', {
            id: 'imperativeText',
            placeholder: 'Enter mandatory instruction...',
            value: item ? item.text : '',
            className: 'alchimist-input w-full resize-none text-sm p-3 bg-black/20 focus:outline-none min-h-[500px]'
        });

        editor.show();
    }

    closeEditor() {
        this.isEditing = false;
        this.editingId = null;
        State.set('is_imperative_editor_active', false);
        this.refresh();
    }

    refresh() {
        const body = this.expander.body;
        body.innerHTML = '';
        body.appendChild(this.renderList());
        this.refreshHeader();
    }
}