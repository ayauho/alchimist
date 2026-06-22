/**
 * @file components/reusable/PersonaCard.js
 * @purpose Renders a synthesized persona with Integration and Re-synth capabilities.
 */
import { dom } from '../../utils/dom.js';
import { State } from '../../services/State.js';
import { log } from '../../utils/logger.js';

export class PersonaCard {
    constructor(container, data, options = {}) {
        this.container = container;
        this.data = data;
        this.onComplete = options.onComplete; // Callback for reset
        this.onReSynth = options.onReSynth;
        this.options = options;
    }

    render() {
        const wrapper = dom.create('div', 'u-w-full u-flex u-flex-col u-fade-in u-min-w-0 gap-3');
        
        if (!this.data) {
            const errorCard = dom.create('div', 'c-editor-card bg-[var(--bg-main)] m-0 u-flex u-items-center u-justify-center');
            errorCard.style.setProperty('padding', '2rem', 'important');
            errorCard.innerHTML = `<span style="color: #ef4444; font-size: 11px; font-family: monospace; letter-spacing: 0.1em;">[ ERR: SUBSTRATE PAYLOAD CORRUPTED OR NULL ]</span>`;
            wrapper.append(errorCard);
            this.container.append(wrapper);
            return;
        }

        // Card Body
        const card = dom.create('div', 'c-editor-card bg-[var(--bg-main)] m-0');
        
        // Sovereign Inline Overrides to crush BEM defaults and bypass Tailwind CDN latency
        card.style.setProperty('flex', 'none', 'important');
        card.style.setProperty('height', 'max-content', 'important');
        card.style.setProperty('min-height', '0', 'important');
        
        card.innerHTML = `
            <div class="u-flex u-items-center u-justify-between" style="margin-bottom: 0.5rem;">
                <div class="u-flex u-items-center" style="gap: 0.75rem;">
                    <span style="font-size: 1.5rem;">${this.data.emoji || '🎭'}</span>
                    <div class="u-min-w-0">
                        <h4 style="font-size: 11px; font-weight: 800; color: var(--text-primary); text-transform: uppercase;">${this.data.name}</h4>
                        <p style="font-size: 9px; color: var(--text-secondary); font-family: monospace;">ID: ${this.data.id}</p>
                    </div>
                </div>
                <div style="padding: 2px 6px; background: var(--accent-glow); border: 1px solid var(--accent); border-radius: 4px; font-size: 8px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; flex-shrink: 0; margin-left:5px;">New Forge</div>
            </div>
            
            ${this.data.desc ? `<p style="font-size: 10px; color: var(--text-primary); opacity: 0.8; line-height: 1.4;">${this.data.desc}</p>` : ''}
            
            <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 0.75rem; font-size: 11px; color: var(--text-secondary); font-style: italic; line-height: 1.5; margin-bottom: 0.75rem;">
                "${this.data.prompt || this.data.text || 'No system directive extracted.'}"
            </div>

            ${this.data.tags && this.data.tags.length ? `
                <div class="u-flex" style="flex-wrap: wrap; gap: 4px;">
                    ${this.data.tags.map(t => '<span style="font-size: 8px; font-weight: 700; color: var(--text-primary); background: var(--accent); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">' + t + '</span>').join('')}
                </div>
            ` : ''}
        `;

        // Action Buttons
        const footer = dom.create('div', 'pe-btn-group u-flex-col mt-2');
        
        const btnIntegrate = dom.create('button', 'pe-btn pe-btn--primary !bg-[#10b981] !border-[#10b981] !text-white', {
            textContent: '[ Integrate to Vault ]',
            onclick: (e) => {
                e.stopPropagation();
                btnIntegrate.disabled = true;
                btnIntegrate.textContent = 'INTEGRATING...';
                
                try {
                    window.dispatchEvent(new CustomEvent('ALCHEMY_INTEGRATION_SUCCESS', { 
                        detail: this.data 
                    }));
                    
                    // Delegate UI transition to orchestrator
                    if (this.onComplete) this.onComplete(this.data);
                } catch (e) {
                    btnIntegrate.disabled = false;
                    btnIntegrate.textContent = 'INTEGRATION FAILED - RETRY?';
                    log('e', 'INTEGRATION_ERROR', e);
                }
            }
        });

        const btnResynth = dom.create('button', 'pe-btn pe-btn--secondary', {
            textContent: this.options.reSynthLabel || 'RE-SYNTH',
            onclick: () => {
                if (this.onReSynth) this.onReSynth();
            }
        });

        footer.append(btnIntegrate, btnResynth);
        wrapper.append(card, footer);
        this.container.append(wrapper);
    }
}