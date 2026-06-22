/**
 * @file components/reusable/Tabs.js
 * @purpose Unified Tab component to ensure structural parity and visual settlement across all modules.
 */
import { dom } from '../../utils/dom.js';

export class Tabs {
    /**
     * @param {Object} options 
     * @param {Array} options.tabs - [{ id, label, icon }]
     * @param {string} options.activeId - Initially active tab
     * @param {Function} options.onSelect - Callback(id)
     * @param {string} options.className - Additional classes for container
     */
    constructor(options) {
        this.tabs = options.tabs || [];
        this.activeId = options.activeId || (this.tabs[0]?.id);
        this.onSelect = options.onSelect;
        this.className = options.className || '';
        this.buttons = new Map();
    }

    render() {
        const container = dom.create('nav', `tabs-container--classic flex items-center ${this.className}`);
        
        this.tabs.forEach(tab => {
            const btn = dom.create('button', 'tabs--classic', { dataset: { tabId: tab.id } });
            if (tab.id === this.activeId) {
                btn.classList.add('tabs--classic-active');
            }
            
            // Icon + Label structure matching project DNA
            const iconHtml = tab.icon || '';
            btn.innerHTML = `${iconHtml} <span class="ml-2">${tab.label}</span>`;
            
            btn.onclick = (e) => {
                e.stopPropagation();
                this.select(tab.id);
            };

            this.buttons.set(tab.id, btn);
            container.appendChild(btn);
        });

        return container;
    }

    select(id) {
        if (id === this.activeId) return;

        // Visual Reconcilliation
        const prev = this.buttons.get(this.activeId);
        const next = this.buttons.get(id);

        if (prev) prev.classList.remove('tabs--classic-active');
        if (next) next.classList.add('tabs--classic-active');

        this.activeId = id;
        if (this.onSelect) this.onSelect(id);
    }
}