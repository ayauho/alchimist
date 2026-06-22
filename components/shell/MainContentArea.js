/**
 * @file components/shell/MainContentArea.js
 * @purpose UI: Main content orchestrator with Forge/Sanctuary lifecycle management.
 */
import { dom } from '../../utils/dom.js';
import { ICONS } from '../../utils/assets.js';
import { Language } from '../../services/Language.js';
import { log } from '../../utils/logger.js';
import { Forge } from '../core/Forge.js';
import { Sanctuary } from '../core/Sanctuary.js';
import { Library } from '../core/Library.js';
import { Features } from '../core/Features.js';
import { Bundles } from '../core/Bundles.js';
import { Configuration } from '../core/Configuration.js';
import { HowItWorks } from '../tutorial/HowItWorks.js';
import { State } from '../../services/State.js';

export class MainContentArea {
    constructor(container) {
        this.container = container;
        this.activeTab = 'Forge';
        this.activeTabInstance = null;
        this.bindGlobalEvents();
    }

    bindGlobalEvents() {
        window.addEventListener('ui:request-tab-switch', (e) => {
            if (e.detail && e.detail.tab) {
                this.switchTab(e.detail.tab);
            }
        });
    }

    render() {
        // Container Structure
        const wrapper = dom.create('div', 'flex-1 flex flex-col h-full w-full min-h-0');
        
        // 1. Tab Bar
        const tabBar = dom.create('nav', 'tabs-container--classic flex items-center bg-black/20');
        const tabs = [
            { id: 'Forge', title: 'TITLE_FORGE', icon: ICONS.FLASK },
              { id: 'Sanctuary', title: 'TITLE_SANCTUARY', icon: ICONS.SANCTUARY },
             { id: 'Library', title: 'TITLE_LIBRARY', icon: ICONS.BOOK_OPEN }
        ];

        tabs.forEach(tab => {
            const btn = dom.create('button', `tabs--classic ${this.activeTab === tab.id ? 'tabs--classic-active' : ''}`, {
                innerHTML: `${tab.icon} <span class="ml-2">${Language.text(tab.title)}</span>`,
                onclick: () => this.switchTab(tab.id)
            });
            btn.dataset.tabId = tab.id;
            tabBar.appendChild(btn);
        });
        
        this.tabBarEl = tabBar;
        wrapper.appendChild(this.tabBarEl);

        // 2. Viewport (The Stage) - Grid layout ensures children overlap exactly instead of stacking
        const viewport = dom.create('div', 'flex-1 flex flex-col overflow-hidden relative min-h-0 min-w-0', { 
            id: 'tab-content-viewport',
            style: 'display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr; min-width: 0;'
        });

        wrapper.appendChild(viewport);
        
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
        this.viewportEl = viewport;

        // Initial View Manifestation
        this.switchTab(this.activeTab, true);
        
        return wrapper;
    }

    switchTab(tabId, force = false) {
        if (!tabId) return;

        // Focus Guard: Prevent DOM wipe if user is interacting with an input on the current tab
        const activeTag = document.activeElement?.tagName;
        const isTyping = activeTag === 'TEXTAREA' || activeTag === 'INPUT';
        if (!force && this.activeTab === tabId && this.activeTabInstance) {
            if (isTyping) {
                log('UI', 'TAB_WIPE_PREVENTED', { id: tabId, reason: 'Active focus detected' });
            }
            return;
        }

        // [V13.S³] Lifecycle Decommissioning Protocol
        if (this.activeTabInstance && typeof this.activeTabInstance.destroy === 'function') {
            this.activeTabInstance.destroy();
        }

        log('UI', 'TAB_SWITCH', { target: tabId });
        
        // [V13.S³] Tab Bar Visibility Gate
        // Hide internal sub-tabs (Forge/Sanctuary) when an external Aspect (Configuration) is mounted
        if (this.tabBarEl) {
             const isCoreAspect = ['Forge', 'Sanctuary', 'Library'].includes(tabId);
            this.tabBarEl.classList.toggle('u-hidden', !isCoreAspect);
        }

        // Dispatch event for Footer visibility reconciliation
        window.dispatchEvent(new CustomEvent('TAB_SWITCH', { detail: { id: tabId } }));

        this.activeTab = tabId;
        State.set('active_tab', tabId);
        
        this.updateTabUI();

        // [V13.S³] Lifecycle Dissolution: Prevent "Abandoned State" by explicitly destroying current instance
        if (this.activeTabInstance && typeof this.activeTabInstance.destroy === 'function') {
            this.activeTabInstance.destroy();
        }

        if (this.viewportEl) this.viewportEl.innerHTML = '';
        
        log('UI', 'TAB_RENDER', { id: tabId });
        this.activeTabInstance = null;
        switch(tabId) {
            case 'Forge': this.activeTabInstance = new Forge(); break;
            case 'Features': this.activeTabInstance = new Features(); break;
            case 'Bundles': this.activeTabInstance = new Bundles(); break;
            case 'Sanctuary': this.activeTabInstance = new Sanctuary(); break;
             case 'Library': this.activeTabInstance = new Library(); break;
            case 'Configuration': this.activeTabInstance = new Configuration(); break;
            case 'HowItWorks': this.activeTabInstance = new HowItWorks(); break;
        }

        if (this.activeTabInstance && this.viewportEl) {
            const view = this.activeTabInstance.render();
            view.style.gridArea = '1 / 1';
            this.viewportEl.appendChild(view);
        }
    }

    updateTabUI() {
        if (!this.tabBarEl) return;
        const btns = this.tabBarEl.querySelectorAll('.tabs--classic');
        btns.forEach(btn => {
            const isActive = btn.dataset.tabId === this.activeTab;
            if (isActive) {
                btn.classList.add('tabs--classic-active');
            } else {
                btn.classList.remove('tabs--classic-active');
            }
        });
    }
}