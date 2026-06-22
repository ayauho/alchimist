/**
 * @file components/reusable/Switcher.js
 * @purpose UI: Reusable state toggle primitive.
 */
import { dom } from '../../utils/dom.js';

export class Switcher {
   constructor(options = {}) {
       this.id = options.id || `switch-${Math.random().toString(36).substr(2, 9)}`;
       this.state = options.initialState || false;
       this.onChange = options.onChange || null;
       this.containerTarget = options.containerTarget || null;
        this.isDisabled = false;
        this._preDisabledState = null;
   }

    setDisabled(isDisabled) {
        if (this.isDisabled === isDisabled) return; // idempotency guard
        this.isDisabled = isDisabled;
        if (isDisabled) {
            this._preDisabledState = this.state;
            if (this.state) {
                // Silent toggle OFF: mutate DOM + state without dispatching onChange
                this.state = false;
                if (this.input) this.input.checked = false;
                if (this.onChange) this.onChange(false);
            }
            if (this.container) this.container.classList.add('switcher--disabled');
            if (this.input) this.input.disabled = true;
             // [ARTICLE] Mark the host row (protocol-row, etc.) so the disabled-cursor + dim apply to the entire click surface,
             // matching how Selector marks .selector-item--disabled. Without this, the row outside the switcher stays clickable-looking.
             if (this.containerTarget) this.containerTarget.classList.add('switcher-host--disabled');
        } else {
            if (this.container) this.container.classList.remove('switcher--disabled');
            if (this.input) this.input.disabled = false;
             if (this.containerTarget) this.containerTarget.classList.remove('switcher-host--disabled');
            if (this._preDisabledState !== null) {
                if (this._preDisabledState && !this.state) {
                    this.toggle();
                }
                this._preDisabledState = null;
            }
        }
    }

   render() {
       this.container = dom.create('div', 'alchimist-switcher');
        
        this.input = dom.create('input', 'alchimist-switcher__input', {
            type: 'checkbox',
            id: this.id
        });
        this.input.checked = this.state;
        
        this.track = dom.create('label', 'alchimist-switcher__track', {
            htmlFor: this.id
        });
        
        this.thumb = dom.create('span', 'alchimist-switcher__thumb');
        this.track.appendChild(this.thumb);
        
        this.container.appendChild(this.input);
        this.container.appendChild(this.track);
        
        this.input.addEventListener('change', (e) => {
            this.state = e.target.checked;
            if (this.onChange) this.onChange(this.state);
        });
        
        if (this.containerTarget) {
            this.containerTarget.addEventListener('click', (e) => {
                if (this.container.contains(e.target)) return;
                e.preventDefault();
                this.toggle();
            });
        }
        
        return this.container;
    }

    toggle() {
         if (this.isDisabled) return;
        this.state = !this.state;
        if (this.input) {
            this.input.checked = this.state;
            this.input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}
