/**
 * @file components/core/Forge/Metric.js
 * @purpose UI: Custom Metrics manager — Inventory (CRUD) + Alchemy (kind='metric') tabs.
 *
 * [V14] Architecture parity:
 *   - Inventory tab mirrors Imperative.js (single-list switcher pattern)
 *   - Two-tab management view mirrors Persona's manage-mode shape
 *   - Alchemy tab mounts Alchemy({kind:'metric'}) — kind-scoped state keys prevent
 *     collision with the Persona-Alchemy instance.
 *   - Integration signal: 'ALCHEMY_METRIC_INTEGRATION_SUCCESS' (NOT the persona event).
 */
import { Expander } from '../../reusable/Expander.js';
import { Switcher } from '../../reusable/Switcher.js';
import { Editor } from '../../reusable/Editor.js';
import { Confirmation } from '../../reusable/Confirmation.js';
import { Alchemy } from '../Alchemy.js';
import { dom } from '../../../utils/dom.js';
import { ICONS } from '../../../utils/assets.js';
import { Language } from '../../../services/Language.js';
import { Storage } from '../../../services/Storage.js';
import { State } from '../../../services/State.js';
import { log } from '../../../utils/logger.js';

export class Metric {
    constructor(container) {
        this.container = container;
        this.items = [];
        this.editingId = null;
        this.managementActiveTab = 'inventory';
        this.alchemyInstance = null;

        this.handleCreateClicked = () => {
            log('UI', 'CREATE_METRIC_SIGNAL_RECEIVED', { instance: 'metric' });
            this.mountEditorOverlay();
        };

        this.handlePresetApplied = async () => {
            this.items = (await Storage.get('metrics')) || [];
            State.set('metrics', this.items);
            if (this.expander && this.expander.body) this.refresh();
        };

        this.handleAlchemyIntegration = async () => {
            // Re-hydrate after AlchemyService.integrateMetric persisted the new item.
            this.items = (await Storage.get('metrics')) || [];
            State.set('metrics', this.items);
            // Snap back to Inventory tab to reveal the new metric.
            this.managementActiveTab = 'inventory';
            if (this.expander && this.expander.body) this.refresh();
        };

        this.handleManagementToggle = (isManaging) => {
            // Reset to inventory whenever management mode opens or closes.
            this.managementActiveTab = 'inventory';
            if (this.alchemyInstance && !isManaging) {
                this.alchemyInstance = null;
            }
        
            // GUARD: Only rebuild the DOM if actively expanding. Rebuilding during collapse 
            // aborts the CSS height transition, stalling the dominance release sequence.
            if (isManaging && this.expander && this.expander.body) {
                this.refresh();
            }
        };

        this.expander = new Expander({
            id: 'exp-metric',
            title: Language.text('TITLE_FORGE_METRICS') || 'Metrics',
            isDominantConfig: true,
            groupId: 'forge-main',
            onToggle: (isExpanded) => {
                State.set('is_managing_metrics', isExpanded);
            }
        });

        window.addEventListener('CREATE_METRIC_CLICKED', this.handleCreateClicked);
        window.addEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.addEventListener('TREASURY_RESTORED', this.handlePresetApplied);
        window.addEventListener('ALCHEMY_METRIC_INTEGRATION_SUCCESS', this.handleAlchemyIntegration);
        this._unsubManaging = State.subscribe('is_managing_metrics', this.handleManagementToggle);

        log('LIFECYCLE', 'METRIC_INSTANCE_CREATED', { containerId: container.id });
    }

    destroy() {
        window.removeEventListener('CREATE_METRIC_CLICKED', this.handleCreateClicked);
        window.removeEventListener('PRESET_APPLIED', this.handlePresetApplied);
        window.removeEventListener('TREASURY_RESTORED', this.handlePresetApplied);
        window.removeEventListener('ALCHEMY_METRIC_INTEGRATION_SUCCESS', this.handleAlchemyIntegration);
        if (this._unsubManaging) this._unsubManaging();
        if (this.expander) this.expander.destroy();
        log('LIFECYCLE', 'METRIC_INSTANCE_DESTROYED');
    }

    async render() {
        const stored = await Storage.get('metrics');
        this.items = stored || [];
        State.set('metrics', this.items);

        this.content = dom.create('div', 'p-3 flex flex-col gap-3 min-h-[300px]');
        this._renderBody();

        const node = this.expander.render(this.content);
        this.container.appendChild(node);
        this.refreshHeader();
    }

    _renderBody() {
        this.content.innerHTML = '';
        const isManaging = State.get('is_managing_metrics');

        if (!isManaging) {
            this.content.appendChild(this._renderInventoryList());
            return;
        }

        // Management view — 2 tabs: Inventory + Alchemy
        const tabsBar = dom.create('div', 'flex bg-[#050505] p-1 gap-1 w-full mb-2');
        const tabs = [
            { id: 'inventory', label: Language.text('TITLE_INVENTORY') || 'Inventory' },
            { id: 'alchemy',   label: Language.text('TITLE_ALCHEMY')   || 'Alchemy' }
        ];
        tabs.forEach(t => {
            const isActive = this.managementActiveTab === t.id;
            const btn = dom.create('button', `alchemy-tab-btn ${isActive ? 'active' : ''}`);
            btn.dataset.theme = t.id === 'inventory' ? 'mutate' : 'cross';
            btn.innerHTML = `<span>${t.label}</span>`;
            btn.addEventListener('click', () => {
                if (this.managementActiveTab === t.id) return;
                this.managementActiveTab = t.id;
                this._renderBody();
            });
            tabsBar.append(btn);
        });
        this.content.appendChild(tabsBar);

        const managementBody = dom.create('div', 'flex flex-col flex-1 w-full');
        this.content.appendChild(managementBody);

        if (this.managementActiveTab === 'inventory') {
            managementBody.appendChild(this._renderInventoryList());
        } else {
            // Alchemy tab — instantiate kind='metric' on first switch, reuse on re-render.
            if (!this.alchemyInstance) {
                this.alchemyInstance = new Alchemy({ kind: 'metric' });
            }
            this.alchemyInstance.render().then(node => {
                managementBody.appendChild(node);
            });
        }
    }

    _renderInventoryList() {
        const wrapper = dom.create('div', 'flex flex-col gap-2');

        if (this.items.length === 0) {
            wrapper.appendChild(dom.create('div', 'text-text-secondary text-xs italic text-center py-10', {
                innerText: Language.text('MSG_NO_METRICS') || 'No metrics defined.'
            }));
            return wrapper;
        }

        this.items.forEach(item => {
            const row = dom.create('div', 'flex items-center justify-between gap-3 p-2 bg-white/5 rounded border border-white/10 group cursor-pointer hover:bg-white/10', {
                onclick: () => this.startEdit(item)
            });

            const contentContainer = dom.create('div', 'flex-1 overflow-hidden min-w-0');
            const nameEl = dom.create('div', 'text-xs text-yellow-400 font-bold truncate', { innerText: item.name });
            const descEl = dom.create('div', 'text-[10px] text-text-secondary line-clamp-2 leading-tight', { innerText: item.desc || '' });
            contentContainer.append(nameEl, descEl);

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

            actionsContainer.append(editBtn, delBtn, switcherNode);
            row.append(contentContainer, actionsContainer);
            wrapper.append(row);
        });

        return wrapper;
    }

    refreshHeader() {
        if (!this.expander) return;
        const activeItems = this.items.filter(item => item.active);
        const indicators = activeItems.map(item => {
            const firstWord = (item.name || '').trim().split(/\s+/)[0] || '...';
            return {
                abbrev: firstWord,
                color: 'rgba(250, 204, 21, 0.6)',
                className: 'bg-yellow-400/10 !rounded-none',
                padding: '2px 4px 1px'
            };
        });
        if (typeof this.expander.updateIndicators === 'function') {
            this.expander.updateIndicators(indicators);
        }
    }

    async saveItem({ name, desc }) {
        const trimmedName = (name || '').trim();
        if (!trimmedName) {
            throw new Error(Language.text('ERR_METRIC_NAME_EMPTY') || 'Metric name cannot be empty.');
        }
        const lower = trimmedName.toLowerCase();

        const isDuplicate = this.items.some(m => m.id !== this.editingId && m.name.toLowerCase() === lower);
        if (isDuplicate) {
            throw new Error(Language.text('ERR_METRIC_DUPLICATE_NAME') || 'A custom metric with this name already exists.');
        }

        const trimmedDesc = (desc || '').trim();

        if (this.editingId) {
            this.items = this.items.map(i => i.id === this.editingId ? { ...i, name: trimmedName, desc: trimmedDesc } : i);
        } else {
            const created_order = (this.items.length > 0 ? Math.max(0, ...this.items.map(i => i.created_order || 0)) : 0) + 1;
            this.items.push({
                id: `mtr-${Date.now()}`,
                name: trimmedName,
                desc: trimmedDesc,
                active: true,
                used: true,
                created_order
            });
        }

        log('DATA', 'METRIC_PERSISTED', { action: this.editingId ? 'edit' : 'create', count: this.items.length });
        State.set('metrics', this.items);
        await Storage.set({ metrics: this.items });
        this.refresh();
    }

    async deleteItem(id) {
        const confirmed = await Confirmation.show(
            Language.text('TITLE_DELETE_METRIC') || 'Delete Metric',
            Language.text('MSG_CONFIRM_DELETE_METRIC') || 'Are you sure you want to delete this metric?'
        );
        if (!confirmed) return;

        this.items = this.items.filter(i => i.id !== id);
        log('DATA', 'METRIC_DELETED_CASCADE', { id });
        State.set('metrics', this.items);
        await Storage.set({ metrics: this.items });
        window.dispatchEvent(new CustomEvent('METRIC_DELETED', { detail: { type: 'metric', id } }));
        this.refresh();
    }

    async toggleActive(id, val) {
        log('DATA', 'METRIC_STATE_MUTATED', { id, active: val });
        this.items = this.items.map(i => i.id === id ? { ...i, active: val, used: val } : i);
        State.set('metrics', this.items);
        await Storage.set({ metrics: this.items });
        this.refreshHeader();
    }

    startEdit(item) {
        this.mountEditorOverlay(item);
    }

    mountEditorOverlay(item = null) {
        if (State.get('is_editor_active')) return;
        this.editingId = item ? item.id : null;
        State.set('is_metric_editor_active', true);

        const editor = new Editor({
            caption: item
                ? (Language.text('TITLE_EDIT_METRIC') || 'EDIT METRIC')
                : (Language.text('TITLE_CREATE_METRIC') || 'CREATE METRIC'),
            captionClass: 'input-label text-[10px]',
            saveText: Language.text('BTN_SAVE') || 'Save',
            cancelText: Language.text('BTN_CANCEL') || 'Cancel',
            onSave: async (data) => {
                await this.saveItem({ name: data.metricName, desc: data.metricDesc });
            },
            onCancel: () => this.closeEditor()
        });

        editor.add('input', {
            id: 'metricName',
            label: 'LABEL_METRIC_NAME',
            placeholder: Language.text('PLACEHOLDER_METRIC_NAME') || 'Enter metric name...',
            value: item ? item.name : ''
        });
        editor.add('textarea', {
            id: 'metricDesc',
            label: 'LABEL_METRIC_DESC',
            placeholder: Language.text('PLACEHOLDER_METRIC_DESC') || 'Describe what this metric measures...',
            value: item ? (item.desc || '') : '',
            className: 'alchimist-input w-full resize-none text-sm p-3 bg-black/20 focus:outline-none min-h-[160px]'
        });

        editor.show();
    }

    closeEditor() {
        this.editingId = null;
        State.set('is_metric_editor_active', false);
        this.refresh();
    }

    refresh() {
        if (!this.expander || !this.expander.body) return;
        const body = this.expander.body;
        body.innerHTML = '';
        body.appendChild(this.content);
        this._renderBody();
        this.refreshHeader();
    }
}
