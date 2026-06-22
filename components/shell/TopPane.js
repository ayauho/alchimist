/**
 * @file components/shell/TopPane.js
 * @purpose UI: Top navigation pane with branding and aspect triggers.
 */
import { dom } from '../../utils/dom.js';
import { ICONS } from '../../utils/assets.js';
import { Language } from '../../services/Language.js';
import { log } from '../../utils/logger.js';

export class TopPane {
    constructor(container) {
        this.container = container;
        this.activeId = 'InfluenceCore';
    }

    render() {
        const header = dom.create('header', 'header');

        // Left Branding
        const branding = dom.create('div', 'header__branding');
        branding.appendChild(dom.create('h1', 'header__title', {
            innerText: Language.text('APP_TITLE')
        }));
        branding.appendChild(dom.create('p', 'header__subtitle', {
            innerText: Language.text('APP_SUBTITLE')
        }));

        // Right Menu
        const menu = dom.create('nav', 'menu', { id: 'main-nav' });
        
        const navItems = [
            { id: 'InfluenceCore', icon: ICONS.INFLUENCE_CORE, title: 'TITLE_CORE' },
            { id: 'Features', icon: ICONS.FEATURES, title: 'TITLE_FEATURES' },
            { id: 'Bundles', icon: ICONS.BUNDLES, title: 'TITLE_BUNDLES' },
            { id: 'Configuration', icon: ICONS.CONFIGURATION, title: 'TITLE_CONFIG' },
            { id: 'HowItWorks', icon: ICONS.HOW_IT_WORKS, title: 'TITLE_HOW' },                                                
        ];

        navItems.forEach(item => {
            const btn = dom.create('button', `menu__item ${this.activeId === item.id ? 'menu__item--active' : ''}`, {
                innerHTML: item.icon,
                title: Language.text(item.title),
                onclick: () => this.handleNav(item.id)
            });
            btn.dataset.id = item.id;
            menu.appendChild(btn);
        });

        header.appendChild(branding);
        header.appendChild(menu);
        
        this.container.innerHTML = '';
        this.container.appendChild(header);
        this.headerEl = header;
    }

    handleNav(aspectId) {
        if (this.activeId === aspectId) return;
        
        log('UI', 'NAV', { target: aspectId });
        
        this.activeId = aspectId;
        this.updateActiveUI();
        
        // Dispatch event for MainContentArea/Footer reconciliation
        window.dispatchEvent(new CustomEvent('ASPECT_CHANGE', { detail: { id: aspectId } }));
        
        // [V13.S³] Routing Bridge
        // Maps top-level Aspect triggers to the MainContentArea viewport controller.
        if (aspectId === 'Configuration') {
            window.dispatchEvent(new CustomEvent('ui:request-tab-switch', { 
                detail: { tab: 'Configuration' } 
            }));
        } else if (aspectId === 'InfluenceCore') {
            // Restore default Forge state when returning to the Core aspect
            window.dispatchEvent(new CustomEvent('ui:request-tab-switch', { 
                detail: { tab: 'Forge' } 
            }));
        } else if (aspectId === 'Features') {
            // [V13.S³] Features Routing
            window.dispatchEvent(new CustomEvent('ui:request-tab-switch', { 
                detail: { tab: 'Features' } 
            }));
        } else if (aspectId === 'Bundles') {
            // [V16] Bundles Routing
            window.dispatchEvent(new CustomEvent('ui:request-tab-switch', {
                detail: { tab: 'Bundles' }
            }));
        } else if (aspectId === 'HowItWorks') {
            window.dispatchEvent(new CustomEvent('ui:request-tab-switch', {
                detail: { tab: 'HowItWorks' }
            }));
        }
    }

    updateActiveUI() {
        const btns = this.headerEl.querySelectorAll('.menu__item');
        btns.forEach(btn => {
            const isActive = btn.dataset.id === this.activeId;
            btn.className = `menu__item ${isActive ? 'menu__item--active' : ''}`;
        });
    }
}