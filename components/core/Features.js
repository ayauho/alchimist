/**
 * @file components/core/Features.js
 * @purpose UI: Orchestrator for the Features manifold.
 */
import { dom } from '../../utils/dom.js';
import { Profile } from './Features/Profile.js';
import { Integrations } from './Features/Integrations.js';
import { Intelligence } from './Features/Intelligence.js';

export class Features {
    constructor() {
        this.container = dom.create('div', 'features-manifold flex flex-col flex-1 min-h-0 w-full relative', { id: 'features-container' });
        this.profile = new Profile();
        this.integrations = new Integrations();
        this.intelligence = new Intelligence();
        this.children = [this.profile, this.integrations, this.intelligence];
        this.manifold_content = null;
    }

    render() {
        this.container.innerHTML = '';
        
        if (!this.manifold_content) {
            this.manifold_content = dom.create('div', 'flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-4 relative w-full min-w-0');
            this.children.forEach(c => {
                this.manifold_content.appendChild(c.render());
            });
        }

        this.container.appendChild(this.manifold_content);
        return this.container;
    }

    destroy() {
        this.children.forEach(c => {
            if (typeof c.destroy === 'function') c.destroy();
        });
    }
}
