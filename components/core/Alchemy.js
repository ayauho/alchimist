/**
 * @file components/core/Alchemy.js
 * @purpose UI: Orchestrator for Persona Alchemy (Synthesize, Mutate, Crossbreed).
 */
import { dom } from '../../utils/dom.js';
import { State } from '../../services/State.js';
import { log } from '../../utils/logger.js';
import { Storage } from '../../services/Storage.js';
import { AlchemyService } from '../../services/AlchemyService.js';
import { Scraper } from '../../modules/Scraper.js';
import { PersonaCard } from '../reusable/PersonaCard.js';
import { Persona } from './Forge/Persona.js';
import { Switcher } from '../reusable/Switcher.js';
import { ICONS } from '../../utils/assets.js';
import { Language } from '../../services/Language.js';
import { Selector } from '../reusable/Selector.js';
import { Expander } from '../reusable/Expander.js';
import { License } from '../../services/License.js';
import { PermissionBroker } from '../../services/PermissionBroker.js';

export class Alchemy {
   constructor({ kind = 'persona' } = {}) {
       // [V14] Kind-mode generalization (audit §8.7 + plan §3.1).
       // For kind='persona' the resolved keys are byte-identical to the legacy literals,
       // so Persona Alchemy's behavior is preserved without touching any render-method body.
       this.kind = kind;
       this.activeTabKey = (kind === 'metric') ? 'alchemy_metric_active_tab' : 'alchemy_active_tab';
       this.resultKey    = (kind === 'metric') ? 'last_metric_alchemy_result' : 'last_alchemy_result';

       this.container = dom.create('div', 'u-flex u-flex-col flex-1 u-w-full overflow-hidden', { id: 'alchemy-root' });
       this.currentTab = State.get(this.activeTabKey) || 'synth';
       this.isProcessing = false;

        // [V13] Inherit-Knowledge ephemeral toggles. Persist across renderView() rebuilds within
        // a single Alchemy mount; reset on component remount. Authoritative source for the value
        // sent to AlchemyService when the user clicks EXECUTE MUTATION / INITIATE HYBRIDIZATION.
        this.mutateInheritKnowledge = false;
        this.crossInheritKnowledge  = false;

       this.slots = {
           mutate: { instance: null, container: dom.create('div', 'flex-shrink-0 w-full'), isolationKey: 'alchemy_mutate' },
           cross1: { instance: null, container: dom.create('div', 'u-h-full u-w-full'), isolationKey: 'alchemy_cross_1' },
           cross2: { instance: null, container: dom.create('div', 'u-h-full u-w-full'), isolationKey: 'alchemy_cross_2' }
       };

       this.selectedMetricMutateId = State.get('metric_active_id_alchemy_mutate') || null;
       this.selectedMetricCross1Id = State.get('metric_active_id_alchemy_cross_1') || null;
       this.selectedMetricCross2Id = State.get('metric_active_id_alchemy_cross_2') || null;

        this.handleDominance = this.handleDominance.bind(this);
        this.handlePersonaChange = (e) => {
            if (this.currentTab === 'mutate') this.updateMutateButtonState(e.detail?.id);
            if (this.currentTab === 'cross') this.updateCrossbreedButtonState();
        };
        
        window.addEventListener('UI_DOMINANCE_CHANGE', this.handleDominance);
        window.addEventListener('UI_PERSONA_CHANGE', this.handlePersonaChange);
    }

    handleDominance(e) {
        if (!this.body) return;
        if (e.detail.isDominant) {
            this.body.style.overflowY = 'hidden';
        } else {
            this.body.style.overflowY = 'auto';
        }
    }

    _premiumBlock(op) {
        if (License.isPremium()) return false;
        window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: `alchemy:${op}` } }));
        log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: `alchemy:${op}` });
        return true;
    }

    // [PREMIUM] Overlay an alchemy action button with a ⚗ Unseal cover for the free tier.
    // The button is kept enabled so the cover (its child) receives the tap; click opens the gate.
    _coverAlchemyButton(btn, actionId) {
        if (!btn || License.isPremium()) return;
        btn.disabled = false;
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        const cover = dom.create('span', 'u-btn-alchemy__premium-cover', {
            style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(5,5,7,0.82);z-index:5;',
            onclick: (e) => { e.stopPropagation(); e.preventDefault(); window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId } })); log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId }); }
        });
        cover.innerHTML = `<span style="padding:3px 12px;font-size:11px;font-weight:800;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;white-space:nowrap;">${Language.text('BTN_PREMIUM') || '⚗ Unseal'}</span>`;
        btn.appendChild(cover);
    }

    async render() {
        this.container.innerHTML = '';
        
        // 1. Tab Nav
        const tabs = dom.create('div', 'flex bg-[#050505] p-1 gap-1 w-full');
        ['synth', 'mutate', 'cross'].forEach(id => {
            const label = id === 'synth' ? 'Synthesize' : id === 'mutate' ? 'Mutate' : 'Crossbreed';
            const icon = id === 'synth' ? ICONS.ALCHEMY_SYNTH : id === 'mutate' ? ICONS.ALCHEMY_MUTATE : ICONS.ALCHEMY_CROSS;
            const isActive = this.currentTab === id;
            const btn = dom.create('button', `alchemy-tab-btn ${isActive ? 'active' : ''}`);
            btn.dataset.theme = id;
            btn.innerHTML = `${icon}<span>${label}</span>`;
            btn.addEventListener('click', () => {
                if (this.currentTab === id || this.isProcessing) return;
                this.currentTab = id;
                State.set(this.activeTabKey, id);
                this.render();
            });
            tabs.append(btn);
        });
        this.container.append(tabs);

        // 2. Content
        this.body = dom.create('div', 'u-flex u-flex-col flex-1 u-w-full overflow-y-auto u-items-center');
        this.body.style.padding = '2rem 1.5rem';
        this.container.append(this.body);

        this.renderView();
        return this.container;
    }

    renderView() {
        if (this._renderTimeout) clearTimeout(this._renderTimeout);
        this._renderTimeout = setTimeout(() => {
            this._executeRenderView();
        }, 32);
    }

    _executeRenderView() {
        log('UI', 'ALCHEMY_RENDER_VIEW', { tab: this.currentTab });
        if (this.body) this.body.style.overflowY = 'auto';
        
        if (this.viewContainer) this.viewContainer.remove();
        this.viewContainer = dom.create('div', 'u-flex u-flex-col flex-1 u-w-full');
        this.body.innerHTML = '';
        this.body.append(this.viewContainer);
        
        if (this.currentTab === 'synth') this.renderSynthesize();
        else if (this.currentTab === 'mutate') this.renderMutate();
        else if (this.currentTab === 'cross') this.renderCrossbreed();
        else this.renderPlaceholder(`[ ${this.currentTab.toUpperCase()} MODULE OFFLINE ]`);
    }

    ensureUniquePersonaId(persona) {
        if (!persona.id) persona.id = `persona-${Date.now()}`;
        
        const existingPersonas = State.get('personas') || {};
        if (!existingPersonas[persona.id]) return persona;

        let baseId = persona.id;
        let counter = 1;

        const match = persona.id.match(/^(.*)-(\d+)$/);
        if (match) {
            baseId = match[1];
            counter = parseInt(match[2], 10) + 1;
        }

        let newId = `${baseId}-${counter}`;
        while (existingPersonas[newId]) {
            counter++;
            newId = `${baseId}-${counter}`;
        }

        persona.id = newId;
        return persona;
    }

    renderSynthesize() {
        // [V14] Kind-mode dispatch — metric path bypasses persona-specific selectors,
        // PersonaCard, and inherit-knowledge logic entirely.
        if (this.kind === 'metric') return this.renderMetricSynthesize();

        const result = State.get('last_alchemy_result');
        if (result && result.type === 'synth') {
            if (!result.data) {
                this.renderPlaceholder('[ SYNTHESIS YIELDED NO STRUCTURAL DATA ]');
                return;
            }
            const card = new PersonaCard(this.viewContainer, result.data, {
                onComplete: async (persona) => {
                    persona = this.ensureUniquePersonaId(persona);
                    log('UI', 'ALCHEMY_INTEGRATE_TRIGGER', { id: persona.id });
                    
                    this.isProcessing = true;
                    
                    await AlchemyService.integrate(persona);
                    
                    State.set('last_alchemy_result', null);
                    
                    this.isProcessing = false;
                    this.renderView();
                },
                onReSynth: () => {
                    State.set('last_alchemy_result', null);
                    this.renderView();
                }
            });
            card.render();
            return;
        }

        const selection = State.get('shadow_selection') || {};
        const isSelected = !!selection.text;

        const wrapper = dom.create('div', 'flex flex-col items-center flex-1 w-full text-center my-auto gap-6');

        wrapper.innerHTML = `
            <div class="max-w-[220px]">
                <h3 class="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-zinc-500">Atomic Synthesis</h3>
                <p class="text-[11px] leading-relaxed text-zinc-400">
                    Analyzes <span class="text-emerald-400 font-bold">${isSelected ? 'selected text' : 'active tab context'}</span> to forge a unique persona blueprint from the noise.
                </p>
            </div>
        `;

        const btn = dom.create('button', 'u-btn-alchemy max-w-[200px]', { textContent: 'Synthesize Now' });
        btn.dataset.theme = 'synth';
        
        btn.addEventListener('click', () => this.handleSynthesize(btn));
        this._coverAlchemyButton(btn, 'alchemy:synth');
        
        wrapper.append(btn);
        this.viewContainer.append(wrapper);
    }

    async handleSynthesize(btn) {
        if (this._premiumBlock('synth')) return;

        const permitted = await PermissionBroker.ensurePermission();
        if (!permitted) {
            log('UI', 'SYNTH_ABORTED_NO_PERMISSION');
            return;
        }

        this.isProcessing = true;
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">Synthesizing...</span>`;
        
        try {
            const topology = await Scraper.extract();

            // Substrate Commitment (Transmutation Parity)
            State.set('page_content', topology.ctrl_a_text || '');
            State.set('context_structure', topology.context_structure || '');

            if (!topology.ctrl_a_text || topology.ctrl_a_text.trim().length === 0) {
                throw new Error("Synthesis failed: No page content detected. Ensure the page has loaded or select text.");
            }

            const context = {
                selected_text: topology.selected_text || '',
                ctrl_a_text: topology.ctrl_a_text || '',
                context_structure: topology.context_structure || ''
            };

            const persona = await AlchemyService.executeSynthesis(context);
            State.set('last_alchemy_result', { type: 'synth', data: persona });
            this.isProcessing = false;
            this.renderView();
        } catch (e) {
            log('e', 'ALCHEMY_UI_ERROR', e);
            btn.textContent = 'ERROR: RETRY?';
            btn.disabled = false;
            this.isProcessing = false;
            State.set('is_error', e);
        }
    }

    renderPlaceholder(text) {
        const div = dom.create('div', 'flex-1 flex items-center justify-center text-[9px] font-mono text-zinc-600 tracking-widest');
        div.textContent = text;
        this.viewContainer.append(div);
    }

    renderMutate() {
        // [V14] Kind-mode dispatch — metric mutate uses an inline dropdown selector
        // (no embedded Persona instance, no inherit-knowledge row).
        if (this.kind === 'metric') return this.renderMetricMutate();

        const result = State.get('last_alchemy_result');
        if (result && result.type === 'mutate') {
            if (!result.data) {
                this.renderPlaceholder('[ MUTATION YIELDED NO STRUCTURAL DATA ]');
                return;
            }
            const resultTitle = dom.create('div', 'text-[10px] font-mono text-zinc-500 mb-2', { textContent: 'MUTATION RESULT' });
            this.viewContainer.append(resultTitle);
            
            const card = new PersonaCard(this.viewContainer, result.data, {
                reSynthLabel: 'RE-EVO',
                onComplete: async (persona) => {
                    persona = this.ensureUniquePersonaId(persona);
                    log('UI', 'ALCHEMY_INTEGRATE_TRIGGER', { id: persona.id });
                    this.isProcessing = true;
                    await AlchemyService.integrate(persona);
                    State.set('last_alchemy_result', null);
                    this.isProcessing = false;
                    this.renderView();
                },
                onReSynth: () => {
                    State.set('last_alchemy_result', null);
                    this.renderView();
                }
            });
            card.render();
            return;
        }

        const wrapper_button = dom.create('div', 'mt-4 w-full');
        
        // [V13] Inherit-Knowledge row — hidden by default; revealed by updateMutateButtonState()
        // only when the currently-selected source persona carries a non-empty persona_knowledge.
        this.mutateInheritRow = dom.create('div', 'protocol-row mt-4 w-full');
        this.mutateInheritRow.style.display = 'none';
        const mInfo = dom.create('div', 'protocol-row__info');
        mInfo.appendChild(dom.create('div', 'protocol-row__title', { innerText: 'Inherit Persona Knowledge' }));
        this.mutateInheritRow.appendChild(mInfo);
        this.mutateInheritSwitcher = new Switcher({
            id: 'switch-alchemy-mutate-inherit',
            initialState: this.mutateInheritKnowledge,
            containerTarget: this.mutateInheritRow,
            onChange: (val) => {
                this.mutateInheritKnowledge = val;
                log('UI', 'ALCHEMY_MUTATE_INHERIT_TOGGLED', { value: val });
            }
        });
        this.mutateInheritRow.appendChild(this.mutateInheritSwitcher.render());

        this.viewContainer.append(this.slots.mutate.container, this.mutateInheritRow, wrapper_button);


        if (!this.slots.mutate.instance) {
            State.set('persona_active_tab_alchemy_mutate', 'all');
            Storage.set({ 'persona_active_tab_alchemy_mutate': 'all' });
            
            this.slots.mutate.instance = new Persona(this.slots.mutate.container, { 
                title: 'BASE SUBJECT',
                id: 'exp-persona-mutate',
                groupId: 'alchemy-mutate',
                isolationKey: this.slots.mutate.isolationKey,
                noManagePersonas: true,
                noCreatePersona: true,
                noSearch: false,
                isSilent: true,
                activeId: State.get('persona_active_id_alchemy_mutate') || 'none',
                allowNone: true,
                isExpanded: false,
                show_all: true,
                activeTab: 'all',
                onSelect: (item) => {
                    State.set('persona_active_id_alchemy_mutate', item.id);
                }
            });
            this.slots.mutate.instance.render();
        }
        this.mutatePersonaInstance = this.slots.mutate.instance;

        this.mutateBtn = dom.create('button', 'u-btn-alchemy', {
            id: 'btn-mutate-persona',
            textContent: this.isProcessing ? 'MUTATING...' : 'EXECUTE MUTATION',
            onclick: async () => {
                if (this._premiumBlock('mutate')) return;
                const persona = this.mutatePersonaInstance.getActivePersona();
                if (!persona || this.isProcessing) return;

                const permitted = await PermissionBroker.ensurePermission();
                if (!permitted) {
                    log('UI', 'MUTATE_ABORTED_NO_PERMISSION');
                    return;
                }

                this.setProcessing(true);
                try {
                    log('ALCHEMY', 'MUTATE_TRIGGER', persona);
                     // [V13] Pass inheritKnowledge ONLY when the row is actually visible AND on. Hidden
                     // row means the selected persona has no knowledge to inherit — sending true in
                     // that state would mislead the AI into fabricating "inherited" knowledge from thin air.
                     const inheritKnowledge = !!(
                         this.mutateInheritRow &&
                         this.mutateInheritRow.style.display !== 'none' &&
                         this.mutateInheritKnowledge
                     );
                     const mutated = await AlchemyService.mutate(persona, { inheritKnowledge });
                    State.set('last_alchemy_result', { type: 'mutate', data: mutated });
                    this.renderView();
                } catch (e) {
                    log('ALCHEMY', 'MUTATE_FAIL', e.message);
                    State.set('is_error', e);
                } finally {
                    this.setProcessing(false);
                }
            }
        });
        this.mutateBtn.dataset.theme = 'mutate';
        wrapper_button.append(this.mutateBtn);
        this._coverAlchemyButton(this.mutateBtn, 'alchemy:mutate');
        
        this.updateMutateButtonState();
    }

    updateMutateButtonState(id) {
        if (!License.isPremium()) return;
        if (!this.mutateBtn || !this.mutatePersonaInstance) return;
        const activeId = id !== undefined ? id : (State.get(this.mutatePersonaInstance.keys.activeId) || this.mutatePersonaInstance.activeId);
        this.mutateBtn.disabled = (!activeId || activeId === 'none' || this.isProcessing);

         // [V13] Inherit-row visibility: surface the toggle ONLY when the source persona carries
         // a non-empty persona_knowledge. When the row hides (no knowledge or no selection), force
         // the switcher state back to false so a stale `true` from a previous persona cannot leak
         // through to the next mutate call.
         if (this.mutateInheritRow) {
             const personas = State.get('personas') || [];
             const persona = personas.find(p => p.id === activeId);
             const hasKnowledge = !!(persona && Array.isArray(persona.persona_knowledge) && persona.persona_knowledge.length > 0);
             this.mutateInheritRow.style.display = hasKnowledge ? '' : 'none';
             if (!hasKnowledge && this.mutateInheritSwitcher && this.mutateInheritSwitcher.state) {
                 this.mutateInheritSwitcher.toggle();
             }
         }
    }

    renderCrossbreed() {
        log('UI', 'ALCHEMY_RENDER_CROSSBREED_START');
        
        // [V14] Kind-mode dispatch — metric crossbreed uses two inline dropdown selectors.
        if (this.kind === 'metric') return this.renderMetricCrossbreed();

        const lastResult = State.get('last_alchemy_result');
        if (lastResult && lastResult.type === 'cross') {
            if (!lastResult.data) {
                this.renderPlaceholder('[ HYBRIDIZATION YIELDED NO STRUCTURAL DATA ]');
                return;
            }
            const resultTitle = dom.create('div', 'text-[10px] font-mono text-zinc-500 mb-2', { textContent: 'CROSSBREED RESULT' });
            this.viewContainer.append(resultTitle);
            
            const card = new PersonaCard(this.viewContainer, lastResult.data, {
                reSynthLabel: 'RE-MERGE',
                onComplete: async (persona) => {
                    persona = this.ensureUniquePersonaId(persona);
                    log('UI', 'ALCHEMY_INTEGRATE_TRIGGER', { id: persona.id });
                    this.isProcessing = true;
                    await AlchemyService.integrate(persona);
                    State.set('last_alchemy_result', null);
                    this.isProcessing = false;
                    this.renderView();
                },
                onReSynth: () => {
                    State.set('last_alchemy_result', null);
                    this.renderView();
                }
            });
            card.render();
            return;
        }

        const wrapper_button = dom.create('div', 'mt-4 w-full');
       
         // [V13] Inherit-Knowledges row for crossbreed — revealed by updateCrossbreedButtonState()
         // when AT LEAST ONE of the two selected source personas carries non-empty persona_knowledge.
         this.crossInheritRow = dom.create('div', 'protocol-row mt-4 w-full');
         this.crossInheritRow.style.display = 'none';
         const cInfo = dom.create('div', 'protocol-row__info');
         cInfo.appendChild(dom.create('div', 'protocol-row__title', { innerText: 'Inherit Personas Knowledges' }));
         this.crossInheritRow.appendChild(cInfo);
         this.crossInheritSwitcher = new Switcher({
             id: 'switch-alchemy-cross-inherit',
             initialState: this.crossInheritKnowledge,
             containerTarget: this.crossInheritRow,
             onChange: (val) => {
                 this.crossInheritKnowledge = val;
                 log('UI', 'ALCHEMY_CROSS_INHERIT_TOGGLED', { value: val });
             }
         });
         this.crossInheritRow.appendChild(this.crossInheritSwitcher.render());

         this.viewContainer.append(this.slots.cross1.container, this.slots.cross2.container, this.crossInheritRow, wrapper_button);

        if (!this.slots.cross1.instance) {
            State.set('persona_active_id_alchemy_cross_1', 'none');
            State.set('persona_active_id_alchemy_cross_2', 'none');
            State.set('persona_active_tab_alchemy_cross_1', 'all');
            State.set('persona_active_tab_alchemy_cross_2', 'all');
            Storage.set({
                'persona_active_id_alchemy_cross_1': 'none',
                'persona_active_id_alchemy_cross_2': 'none',
                'persona_active_tab_alchemy_cross_1': 'all',
                'persona_active_tab_alchemy_cross_2': 'all'
            });

            this.slots.cross1.instance = new Persona(this.slots.cross1.container, { 
                title: 'PERSONA-1',
                id: 'exp-persona-cross-1',
                groupId: 'alchemy-cross',
                isolationKey: this.slots.cross1.isolationKey,
                noManagePersonas: true,
                noCreatePersona: true,
                noSearch: false,
                isSilent: true,
                activeId: 'none',
                allowNone: true,
                isExpanded: false,
                show_all: true,
                activeTab: 'all',
                onSelect: (item) => {
                    State.set('persona_active_id_alchemy_cross_1', item.id);
                }
            });
            this.slots.cross1.instance.render();
        }
        this.crossPersona1 = this.slots.cross1.instance;

        if (!this.slots.cross2.instance) {
            this.slots.cross2.instance = new Persona(this.slots.cross2.container, { 
                title: 'PERSONA-2',
                id: 'exp-persona-cross-2',
                groupId: 'alchemy-cross',
                isolationKey: this.slots.cross2.isolationKey,
                noManagePersonas: true,
                noCreatePersona: true,
                noSearch: false,
                isSilent: true,
                activeId: 'none',
                allowNone: true,
                isExpanded: false,
                show_all: true,
                activeTab: 'all',
                onSelect: (item) => {
                    State.set('persona_active_id_alchemy_cross_2', item.id);
                }
            });
            this.slots.cross2.instance.render();
        }
        this.crossPersona2 = this.slots.cross2.instance;

        // Ensure unfavorited synthesized personas remain visible
        if (this.crossPersona1.activeTab !== 'all') {
             this.crossPersona1.activeTab = 'all';
             if (this.crossPersona1.refreshPersonaList) this.crossPersona1.refreshPersonaList();
        }
        if (this.crossPersona2.activeTab !== 'all') {
             this.crossPersona2.activeTab = 'all';
             if (this.crossPersona2.refreshPersonaList) this.crossPersona2.refreshPersonaList();
        }

        this.crossBtn = dom.create('button', 'u-btn-alchemy', {
            id: 'btn-crossbreed-personas',
            textContent: this.isProcessing ? 'CROSSBREEDING...' : 'INITIATE HYBRIDIZATION',
            onclick: async () => {
                if (this._premiumBlock('cross')) return;
                const p1 = this.crossPersona1.getActivePersona();
                const p2 = this.crossPersona2.getActivePersona();
                if (!p1 || !p2 || this.isProcessing) return;

                this.setProcessing(true);
                try {
                    log('ALCHEMY', 'CROSSBREED_TRIGGER', { persona1: p1, persona2: p2 });
                     // [V13] Same visibility-AND-on gate as mutate. If the row is hidden, neither
                     // parent has knowledge — sending true would invite hallucination.
                     const inheritKnowledge = !!(
                         this.crossInheritRow &&
                         this.crossInheritRow.style.display !== 'none' &&
                         this.crossInheritKnowledge
                     );
                     const crossbred = await AlchemyService.crossbreed(p1, p2, false, { inheritKnowledge });
                    State.set('last_alchemy_result', { type: 'cross', data: crossbred });
                    this.renderView();
                } catch (e) {
                    log('ALCHEMY', 'CROSSBREED_FAIL', e.message);
                    State.set('is_error', e);
                } finally {
                    this.setProcessing(false);
                }
            }
        });
        this.crossBtn.dataset.theme = 'cross';
        wrapper_button.append(this.crossBtn);
        this._coverAlchemyButton(this.crossBtn, 'alchemy:cross');
        
        this.updateCrossbreedButtonState();
    }

    updateCrossbreedButtonState() {
        if (!License.isPremium()) return;
        if (!this.crossBtn || !this.crossPersona1 || !this.crossPersona2) return;
        const id1 = State.get(this.crossPersona1.keys.activeId) || this.crossPersona1.activeId;
        const id2 = State.get(this.crossPersona2.keys.activeId) || this.crossPersona2.activeId;
        const isValid1 = id1 && id1 !== 'none';
        const isValid2 = id2 && id2 !== 'none';
        const isDifferent = id1 !== id2;
       
        this.crossBtn.disabled = (!isValid1 || !isValid2 || !isDifferent || this.isProcessing);
       
        if (!isDifferent && isValid1 && isValid2) {
            this.crossBtn.textContent = 'SELECT DIFFERENT PERSONAS';
        } else {
            this.crossBtn.textContent = this.isProcessing ? 'CROSSBREEDING...' : 'INITIATE HYBRIDIZATION';
        }

         // [V13] Inherit-row visibility: surface the toggle when AT LEAST ONE of the two source
         // personas has non-empty knowledge. Force-reset to false on hide so a stale `true` from a
         // previous pairing cannot leak. Computed even when persona pair is invalid (id1===id2 or
         // a slot empty) — in those cases neither persona resolves and the row hides naturally.
         if (this.crossInheritRow) {
             const personas = State.get('personas') || [];
             const p1 = personas.find(p => p.id === id1);
             const p2 = personas.find(p => p.id === id2);
             const k1len = (p1 && Array.isArray(p1.persona_knowledge)) ? p1.persona_knowledge.length : 0;
             const k2len = (p2 && Array.isArray(p2.persona_knowledge)) ? p2.persona_knowledge.length : 0;
             const anyKnowledge = (k1len + k2len) > 0;
             this.crossInheritRow.style.display = anyKnowledge ? '' : 'none';
             if (!anyKnowledge && this.crossInheritSwitcher && this.crossInheritSwitcher.state) {
                 this.crossInheritSwitcher.toggle();
             }
         }
    }

    setProcessing(val) {
        if (!License.isPremium()) return;
        this.isProcessing = val;
        if (this.mutateBtn) {
            this.mutateBtn.disabled = val;
            this.mutateBtn.textContent = val ? 'MUTATING...' : 'EXECUTE MUTATION';
        }
        if (this.crossBtn) {
            this.crossBtn.disabled = val;
            if (val) {
                this.crossBtn.textContent = 'CROSSBREEDING...';
            } else {
                this.updateCrossbreedButtonState();
            }
        }
    }

    // ===================================================================
    // [V14] METRIC ALCHEMY — render methods for kind === 'metric'
    // ===================================================================
    // Result card is INLINE per spec (no MetricCard.js file).
    // Selectors are INLINE dropdowns over State.get('metrics') (no embedded Forge/Persona).
    // State writes use this.resultKey (= 'last_metric_alchemy_result').

    _renderMetricResultCard(metric, type, reSynthLabel) {
        const wrapper = dom.create('div', 'flex flex-col items-center gap-4 w-full');

        if (type !== 'synth') {
            const title = dom.create('div', 'text-[10px] font-mono text-zinc-500', {
                textContent: type === 'mutate' ? 'MUTATION RESULT' : 'CROSSBREED RESULT'
            });
            wrapper.append(title);
        }

        const card = dom.create('div', 'w-full p-3 bg-white/5 rounded border border-yellow-400/30 flex flex-col gap-2');
        const nameEl = dom.create('div', 'text-sm font-bold text-yellow-400', { textContent: metric.name || '(unnamed)' });
        const descEl = dom.create('div', 'text-[11px] text-zinc-400 leading-relaxed', { textContent: metric.desc || '' });
        card.append(nameEl, descEl);
        wrapper.append(card);

        const btnRow = dom.create('div', 'flex gap-2 w-full');
        const integrateBtn = dom.create('button', 'u-btn-alchemy flex-1', { textContent: Language.text('BTN_METRIC_INTEGRATE') || 'INTEGRATE TO VAULT' });
        integrateBtn.dataset.theme = type;
        integrateBtn.addEventListener('click', async () => {
            log('UI', 'METRIC_ALCHEMY_INTEGRATE_TRIGGER', { id: metric.id, type });
            this.isProcessing = true;
            integrateBtn.disabled = true;
            try {
                await AlchemyService.integrateMetric(metric);
                State.set(this.resultKey, null);
            } catch (e) {
                log('e', 'METRIC_INTEGRATE_FAIL', e);
                State.set('is_error', e);
            } finally {
                this.isProcessing = false;
                this.renderView();
            }
        });

        const reBtn = dom.create('button', 'u-btn-alchemy flex-1', { textContent: reSynthLabel });
        reBtn.dataset.theme = type;
        reBtn.style.opacity = '0.7';
        reBtn.addEventListener('click', () => {
            State.set(this.resultKey, null);
            this.renderView();
        });

        btnRow.append(integrateBtn, reBtn);
        wrapper.append(btnRow);
        this.viewContainer.append(wrapper);
    }

    renderMetricSynthesize() {
        const result = State.get(this.resultKey);
        if (result && result.type === 'synth') {
            return this._renderMetricResultCard(result.data, 'synth', Language.text('BTN_METRIC_RESYNTH') || 'RE-SYNTH');
        }

        const selection = State.get('shadow_selection') || {};
        const isSelected = !!selection.text;
        const ctxLabel = isSelected ? 'selected text' : 'active tab context';

        const wrapper = dom.create('div', 'flex flex-col items-center flex-1 w-full text-center my-auto gap-6');
        const intro = (Language.text('MSG_METRIC_SYNTH_INTRO') || 'Analyzes {context} to forge a unique metric blueprint from the noise.').replace('{context}', `<span class="text-emerald-400 font-bold">${ctxLabel}</span>`);
        wrapper.innerHTML = `
            <div class="max-w-[220px]">
                <h3 class="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-zinc-500">Atomic Synthesis</h3>
                <p class="text-[11px] leading-relaxed text-zinc-400">${intro}</p>
            </div>
        `;

        const btn = dom.create('button', 'u-btn-alchemy max-w-[200px]', { textContent: 'Synthesize Now' });
        btn.dataset.theme = 'synth';
        btn.addEventListener('click', () => this.handleSynthesizeMetric(btn));
        this._coverAlchemyButton(btn, 'alchemy:metric-synth');

        wrapper.append(btn);
        this.viewContainer.append(wrapper);
    }

    async handleSynthesizeMetric(btn) {
        if (this._premiumBlock('metric-synth')) return;

        const permitted = await PermissionBroker.ensurePermission();
        if (!permitted) {
            log('UI', 'METRIC_SYNTH_ABORTED_NO_PERMISSION');
            return;
        }

        this.isProcessing = true;
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">Synthesizing...</span>`;

        try {
            const topology = await Scraper.extract();
            State.set('page_content', topology.ctrl_a_text || '');
            State.set('context_structure', topology.context_structure || '');

            if (!topology.ctrl_a_text || topology.ctrl_a_text.trim().length === 0) {
                throw new Error("Metric synthesis failed: No page content detected.");
            }

            const context = {
                selected_text: topology.selected_text || '',
                ctrl_a_text: topology.ctrl_a_text || '',
                context_structure: topology.context_structure || ''
            };

            const metric = await AlchemyService.synthesizeMetric(context);
            State.set(this.resultKey, { type: 'synth', data: metric });
            this.isProcessing = false;
            this.renderView();
        } catch (e) {
            log('e', 'METRIC_ALCHEMY_UI_ERROR', e);
            btn.textContent = 'ERROR: RETRY?';
            btn.disabled = false;
            this.isProcessing = false;
            State.set('is_error', e);
        }
    }

    _renderMetricSelector(slotKey, title, activeId, disabledId, onSelect) {
        const metrics = (State.get('metrics') || []).filter(m => m && m.name);
        const selected = metrics.find(m => m.id === activeId);

        const expander = new Expander({
            id: `exp-metric-slot-${slotKey}`,
            title: title,
            isExpanded: false,
            groupId: `alchemy-metric-${slotKey}`,
            isSilent: true
        });

        const content = dom.create('div', 'p-2 bg-black/10 rounded border border-white/5');

        if (metrics.length === 0) {
            content.appendChild(dom.create('div', 'text-zinc-500 text-xs italic text-center p-4', {
                innerText: Language.text('MSG_NO_METRICS') || 'No metrics defined.'
            }));
        } else {
            const selector = new Selector({
                items: metrics,
                activeId: activeId,
                disabledIds: disabledId ? [disabledId] : [],
                onSelect: (item) => {
                    expander.updateSubtitle(item ? item.name : 'NONE');
                    expander.collapse();
                    onSelect(item);
                },
                itemConstructor: {
                    render: (item, isActive, onSelectCallback) => {
                        // Reverting to standard Selector API compliant rendering.
                        // Removing manual innerHTML injection to allow Selector.js 
                        // to maintain control over event delegation and attribute decoration.
                        const itemEl = dom.create('div', 'selector-item');
                        itemEl.onclick = onSelectCallback;
                        const info = dom.create('div', 'selector-item__info');
                        info.innerHTML = `<div class="selector-item__name text-yellow-400 font-bold">${item.name}</div><div class="selector-item__desc u-truncate-rows">${item.desc || ''}</div>`;
                        itemEl.appendChild(info);
                        
                        if (isActive) {
                            const check = dom.create('div', 'selector-item__icon', {
                                innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                            });
                            itemEl.appendChild(check);
                        }
                        return itemEl;
                    }
                }
            });

            content.appendChild(selector.render());
        }

        const node = expander.render(content);
        
        expander.updateSubtitle(selected ? selected.name : 'NONE');

        return node;
    }

    renderMetricMutate() {
        const result = State.get(this.resultKey);
        if (result && result.type === 'mutate') {
            return this._renderMetricResultCard(result.data, 'mutate', Language.text('BTN_METRIC_REEVO') || 'RE-EVO');
        }

        const wrapper = dom.create('div', 'flex flex-col gap-4 w-full pt-4');

        // Cache the expander node container to prevent DOM thrashing on re-renders
        if (!this.slots.mutate.container) this.slots.mutate.container = dom.create('div', 'w-full');

        const selectorNode = this._renderMetricSelector(
            'mutate',
            Language.text('LABEL_BASE_INDICATOR') || 'BASE INDICATOR',
            this.selectedMetricMutateId,
            null,
            (item) => {
                this.selectedMetricMutateId = item ? item.id : null;
                State.set('metric_active_id_alchemy_mutate', this.selectedMetricMutateId);
                // Re-evaluate button state instead of full view wipe
                this.updateMetricActionButtons();
            }
        );
        
        if (!this.slots.mutate.expander) {
             this.slots.mutate.expander = this._renderMetricSelector('mutate', Language.text('LABEL_BASE_INDICATOR') || 'BASE INDICATOR', this.selectedMetricMutateId, null, (item) => {
                 this.selectedMetricMutateId = item ? item.id : null;
                 State.set('metric_active_id_alchemy_mutate', this.selectedMetricMutateId);
                 this.updateMetricActionButtons();
             });
             this.slots.mutate.container.appendChild(this.slots.mutate.expander);
        }
        wrapper.append(this.slots.mutate.container);

        const btn = dom.create('button', 'u-btn-alchemy', { textContent: Language.text('BTN_EXECUTE_MUTATION') || 'EXECUTE MUTATION' });
        btn.dataset.theme = 'mutate';
        btn.disabled = !this.selectedMetricMutateId || this.isProcessing;
        btn.addEventListener('click', async () => {
            if (this._premiumBlock('metric-mutate')) return;
            const metrics = State.get('metrics') || [];
            const selectedMetric = metrics.find(m => m.id === this.selectedMetricMutateId);
            if (!selectedMetric) return;

            const permitted = await PermissionBroker.ensurePermission();
            if (!permitted) {
                log('UI', 'METRIC_MUTATE_ABORTED_NO_PERMISSION');
                return;
            }

            this.isProcessing = true;
            btn.disabled = true;
            btn.innerHTML = `<span class="animate-pulse">Mutating...</span>`;
            try {
                const mutated = await AlchemyService.mutateMetric(selectedMetric);
                State.set(this.resultKey, { type: 'mutate', data: mutated });
                this.isProcessing = false;
                this.renderView();
            } catch (e) {
                log('e', 'METRIC_ALCHEMY_UI_ERROR', e);
                btn.textContent = 'ERROR: RETRY?';
                btn.disabled = false;
                this.isProcessing = false;
                State.set('is_error', e);
            }
        });
        wrapper.append(btn);
        this.mutateBtn = btn;
        this._coverAlchemyButton(btn, 'alchemy:metric-mutate');
        this.viewContainer.append(wrapper);
        this.updateMetricActionButtons();
    }

    renderMetricCrossbreed() {
        const result = State.get(this.resultKey);
        if (result && result.type === 'cross') {
            return this._renderMetricResultCard(result.data, 'cross', Language.text('BTN_METRIC_REMERGE') || 'RE-MERGE');
        }

        const wrapper = dom.create('div', 'flex flex-col gap-4 w-full pt-4');

        if (!this.slots.cross1.container) this.slots.cross1.container = dom.create('div', 'w-full');
        if (!this.slots.cross2.container) this.slots.cross2.container = dom.create('div', 'w-full');

        if (!this.slots.cross1.expander) {
            this.slots.cross1.expander = this._renderMetricSelector('cross1', Language.text('LABEL_METRIC_1') || 'METRIC-1', this.selectedMetricCross1Id, this.selectedMetricCross2Id, (item) => {
                this.selectedMetricCross1Id = item ? item.id : null;
                State.set('metric_active_id_alchemy_cross_1', this.selectedMetricCross1Id);
                this.updateMetricActionButtons();
            });
            this.slots.cross1.container.appendChild(this.slots.cross1.expander);
        }
        
        if (!this.slots.cross2.expander) {
            this.slots.cross2.expander = this._renderMetricSelector('cross2', Language.text('LABEL_METRIC_2') || 'METRIC-2', this.selectedMetricCross2Id, this.selectedMetricCross1Id, (item) => {
                this.selectedMetricCross2Id = item ? item.id : null;
                State.set('metric_active_id_alchemy_cross_2', this.selectedMetricCross2Id);
                this.updateMetricActionButtons();
            });
            this.slots.cross2.container.appendChild(this.slots.cross2.expander);
        }

        wrapper.append(this.slots.cross1.container, this.slots.cross2.container);

        const same = this.selectedMetricCross1Id && this.selectedMetricCross2Id && this.selectedMetricCross1Id === this.selectedMetricCross2Id;
        const canCross = this.selectedMetricCross1Id && this.selectedMetricCross2Id && !same;

        const btn = dom.create('button', 'u-btn-alchemy', {
            textContent: same
                ? (Language.text('BTN_METRIC_SELECT_DIFFERENT') || 'SELECT DIFFERENT METRICS')
                : (Language.text('BTN_INITIATE_HYBRIDIZATION') || 'INITIATE HYBRIDIZATION')
        });
        btn.dataset.theme = 'cross';
        btn.disabled = !canCross || this.isProcessing;
        btn.addEventListener('click', async () => {
            if (this._premiumBlock('metric-cross')) return;
            const metrics = State.get('metrics') || [];
            const m1 = metrics.find(m => m.id === this.selectedMetricCross1Id);
            const m2 = metrics.find(m => m.id === this.selectedMetricCross2Id);
            if (!m1 || !m2 || m1.id === m2.id) return;

            this.isProcessing = true;
            btn.disabled = true;
            btn.innerHTML = `<span class="animate-pulse">Crossbreeding...</span>`;
            try {
                const crossbred = await AlchemyService.crossbreedMetric(m1, m2);
                State.set(this.resultKey, { type: 'cross', data: crossbred });
                this.isProcessing = false;
                this.renderView();
            } catch (e) {
                log('e', 'METRIC_ALCHEMY_UI_ERROR', e);
                btn.textContent = 'ERROR: RETRY?';
                btn.disabled = false;
                this.isProcessing = false;
                State.set('is_error', e);
            }
        });
        wrapper.append(btn);
        this.crossBtn = btn;
        this._coverAlchemyButton(btn, 'alchemy:metric-cross');
        this.viewContainer.append(wrapper);
        this.updateMetricActionButtons();
    }
    
    updateMetricActionButtons() {
        if (!License.isPremium()) return;
        if (this.currentTab === 'mutate' && this.mutateBtn) {
            this.mutateBtn.disabled = !this.selectedMetricMutateId || this.isProcessing;
        } else if (this.currentTab === 'cross' && this.crossBtn) {
            const same = this.selectedMetricCross1Id && this.selectedMetricCross2Id && this.selectedMetricCross1Id === this.selectedMetricCross2Id;
            const canCross = this.selectedMetricCross1Id && this.selectedMetricCross2Id && !same;
            this.crossBtn.disabled = !canCross || this.isProcessing;
            this.crossBtn.textContent = same
                ? (Language.text('BTN_METRIC_SELECT_DIFFERENT') || 'SELECT DIFFERENT METRICS')
                : (Language.text('BTN_INITIATE_HYBRIDIZATION') || 'INITIATE HYBRIDIZATION');
        }
    }

    destroy() {
        window.removeEventListener('UI_DOMINANCE_CHANGE', this.handleDominance);
        window.removeEventListener('UI_PERSONA_CHANGE', this.handlePersonaChange);
        if (this._renderTimeout) clearTimeout(this._renderTimeout);

        // [V13] CASCADE DESTRUCTION: Prevent ghost instances from surviving the tab switch
        const activeSlots = [this.slots.mutate, this.slots.cross1, this.slots.cross2];
        for (const slot of activeSlots) {
            if (slot && slot.instance && typeof slot.instance.destroy === 'function') {
                slot.instance.destroy();
                slot.instance = null;
            }
        }
        this.mutatePersonaInstance = null;
        this.crossPersona1 = null;
        this.crossPersona2 = null;
    }
}