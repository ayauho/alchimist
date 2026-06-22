/**
 * @file components/reusable/Selector.js
 * @purpose UI: Generic list-based selector.
 */
import { dom } from '../../utils/dom.js';
import { log } from '../../utils/logger.js';
import { State } from '../../services/State.js';
import { License } from '../../services/License.js';
import { Language } from '../../services/Language.js';

export class Selector {
   constructor(options = {}) {
       this.items = options.items || [];
       this.activeId = options.activeId || null;
       this.onSelect = options.onSelect || null;
       this.id = options.id || `sel-${Math.random().toString(36).substr(2, 9)}`;
       this.itemConstructor = options.itemConstructor || null;
        this.disabledIds = new Set(options.disabledIds || []);
        this.emptyText = options.emptyText || null;

       // Listen for alignment signals
       this.unsub = State.subscribe('ui_focus_target', (target) => {
           if (target && target.type === 'persona' && target.action === 'align-top') {
               this.scrollToItem(target.id);
           }
       });

       // Re-render gated options when the license tier flips at runtime.
       this._onLicenseChange = () => { if (this.container) this.refresh(); };
       window.addEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
   }

    setDisabledIds(ids = []) {
        this.disabledIds = new Set(ids || []);
        if (this.container) this.refresh();
    }

   render(options = {}) {
       const classes = `selector-list ${options.hasTools ? 'has-tools' : ''}`;
       this.container = dom.create('div', classes, { id: this.id });
       
       if (options.hasTools) {
           //this.container.style.paddingTop = 'var(--persona-tools-height)';
       }

       this.refresh();
       return this.container;
   }

   refresh() {
       if (!this.container) return;
       this.container.innerHTML = '';

       // [V16] Empty-state affordance (e.g. after a bundle revoke leaves zero personas).
       if ((!this.items || this.items.length === 0) && this.emptyText) {
           this.container.appendChild(dom.create('div', 'selector-empty text-xs text-[var(--text-secondary)] italic text-center p-4', { innerText: this.emptyText }));
           return;
       }

       this.items.forEach(item => {
           const isActive = item.id === this.activeId;
            const isDisabled = this.disabledIds.has(item.id);
             const isPremiumLocked = !!item.premiumLocked && !License.isPremium();
           
           // Use Delegate Constructor if provided
           if (this.itemConstructor) {
               const itemEl = this.itemConstructor.render(
                   item, 
                   isActive, 
                   () => this.handleSelect(item),
                   null, // actions
                   this.getItemOptions ? this.getItemOptions(item) : {}
               );
                if (isDisabled) {
                    itemEl.classList.add('selector-item--disabled');
                    itemEl.onclick = (e) => { e.stopPropagation(); log('UI', 'SELECTOR_DISABLED_CLICK', { id: item.id, sel: this.id }); };
                }
                if (isPremiumLocked) {
                    itemEl.classList.add('selector-item--premium');
                    if (!isDisabled) {
                        itemEl.onclick = (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `option:${item.id}` } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `option:${item.id}` }); };
                    }
                }
               this.container.appendChild(itemEl);
               return;
           }

           // Fallback Simple Rendering
           const itemEl = dom.create('div', `selector-item ${isActive ? 'selector-item--active' : ''} ${isDisabled ? 'selector-item--disabled' : ''} ${isPremiumLocked ? 'selector-item--premium' : ''}`, {
               onclick: isDisabled
                   ? (e) => { e.stopPropagation(); log('UI', 'SELECTOR_DISABLED_CLICK', { id: item.id, sel: this.id }); }
                   : isPremiumLocked
                       ? (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `option:${item.id}` } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `option:${item.id}` }); }
                       : () => this.handleSelect(item),
               id: `persona-${item.id}`,
                dataset: { id: item.id }
           });

            const label = dom.create('span', 'selector-item__label', {
                innerText: item.name
            });

            itemEl.appendChild(label);
            if (isPremiumLocked) {
                itemEl.appendChild(dom.create('span', 'selector-item__premium-badge', {
                    innerHTML: (Language.text('BTN_PREMIUM') || '⚗ Unseal'),
                    style: 'margin-left:auto;padding:1px 7px;font-size:9px;font-weight:700;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;white-space:nowrap;'
                }));
            }
            
            if (isActive) {
                const check = dom.create('div', 'selector-item__icon', {
                    innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                });
                itemEl.appendChild(check);
            }

            this.container.appendChild(itemEl);
        });
    }

    handleSelect(item) {
        const isReSelect = this.activeId === item.id;
        this.activeId = isReSelect ? null : item.id;
        this.refresh();
        log('UI', 'SELECTOR', { id: this.id, action: isReSelect ? 'deselect' : 'select', target: item.id });
        if (this.onSelect) this.onSelect(item, isReSelect);
    }

    scrollToItem(id) {
        if (!this.container) return;
        requestAnimationFrame(() => {
            const item = this.container.querySelector(`[data-id="${id}"], #persona-${id}`);
            if (item) {
                const raw_offset = item.offsetTop;
                const adjustment = this.container.classList.contains('has-tools') ? 38 : 0;
                
                const scroller = this.container.closest('.expandable-body') || this.container.parentElement;
                if (scroller) {
                    scroller.scrollTop = raw_offset - adjustment;
                }
            }
        });
    }

    destroy() {
        if (this.unsub) this.unsub();
        if (this._onLicenseChange) window.removeEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
    }
}
