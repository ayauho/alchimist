/**
 * @file components/core/Forge.js
 * @purpose UI: Orchestrator for the Forge tab inputs.
 */
import { dom } from '../../utils/dom.js';
import { Persona } from './Forge/Persona.js';
import { Strategy } from './Forge/Strategy.js';
import { Mode } from './Forge/Mode.js';
import { Attachment } from './Forge/Attachment.js';
import { Intelligence } from './Forge/Intelligence.js';
import { Protocols } from './Forge/Protocols.js';
import { Directive } from './Forge/Directive.js';
import { Imperative } from './Forge/Imperative.js';
import { Preset } from './Forge/Preset.js';
import { Article } from './Forge/Article.js';
// [V14] Metric expander — Inventory + Alchemy tabs, mirrors Imperative+Persona shape.
import { Metric } from './Forge/Metric.js';
import { log } from '../../utils/logger.js';
import { State } from '../../services/State.js';
import { Storage } from '../../services/Storage.js';
import { Language } from '../../services/Language.js';

export class Forge {
    constructor() {
        this.container = dom.create('div', 'flex flex-col flex-1 min-h-0 w-full relative', { id: 'forge-container' });
        this.handleDominance = this.handleDominance.bind(this);
        this.children = [];
        window.addEventListener('UI_DOMINANCE_CHANGE', this.handleDominance);
        // [V14] Generalized management toggle — drives BOTH Persona and Metric expansion
        // dominance through a single handler keyed by expander id (plan §3.2).
        this._handleManagementToggle = this._handleManagementToggle.bind(this);
        this.unsubPersonas = State.subscribe('is_managing_personas', (isMgr) => this._handleManagementToggle('exp-persona', isMgr));
        this.unsubMetrics  = State.subscribe('is_managing_metrics',  (isMgr) => this._handleManagementToggle('exp-metric',  isMgr));
    }

    render() {
         // [V13.S³] Zombie Purge: Destroy accumulated child instances to prevent listener bleed
         this.children.forEach(c => { if (typeof c.destroy === 'function') c.destroy(); });
         this.children = [];
        this.container.innerHTML = '';
        
        // Structural Flex Shell: Scrollable Top Area
        this.scrollWrapper = dom.create('div', 'w-full flex-1 overflow-y-auto custom-scrollbar', { id: 'forge-scroll-wrapper' });
        this.container.append(this.scrollWrapper);

        // Directive Wrapper: Persistent Bottom Area
        this.directiveWrapper = dom.create('div', 'forge-directive-wrapper', { id: 'forge-directive-wrapper' });
        this.container.append(this.directiveWrapper);

        // [V19] The directive bar is position:absolute (out of flow), so flex reserves no
        // space for it and the bottom of the scroll content hides behind it. Measure the
        // directive's live height (varies: history toggle + textarea max-height:66vh) and
        // publish it as --directive-height, consumed by #forge-scroll-wrapper padding.
        if (this._directiveResizeObserver) this._directiveResizeObserver.disconnect();
        this._directiveResizeObserver = new ResizeObserver((entries) => {
            const h = entries[0]?.contentRect?.height ?? 0;
            this.container.style.setProperty('--directive-height', `${Math.ceil(h)}px`);
        });
        this._directiveResizeObserver.observe(this.directiveWrapper);

        // [V18.3] Ordered slot wrappers. Created synchronously in declaration order so
        // each expander's node lands in a fixed DOM position regardless of which async
        // hydration resolves first. Without these, concurrent Promise.all hydration
        // appended nodes in resolution order — on warm (_resonanceBuffer) reads the
        // slower Intelligence expander lost the race and jumped below Preset.
        const slot = (id) => {
            const s = dom.create('div', 'forge-slot w-full', { id: `forge-slot-${id}` });
            this.scrollWrapper.append(s);
            return s;
        };
        const slots = {
            persona:      slot('persona'),
            strategy:     slot('strategy'),
            mode:         slot('mode'),
            protocols:    slot('protocols'),
            imperative:   slot('imperative'),
            attachment:   slot('attachment'),
            intelligence: slot('intelligence'),
            metric:       slot('metric'),
            article:      slot('article'),
            preset:       slot('preset')
        };

        // [CLEAR] Forge-wide "clear" link, centered directly under the Presets expander (the last
        // slot). Dimmer + smaller + underlined per spec. Delegates to the Preset controller's
        // _clearForgeSelections(), which preserves Persona / Strategy / Mode.
        const clearRow = dom.create('div', 'w-full flex justify-center py-2');
        const clearLink = dom.create('button', 'text-xs text-zinc-500 hover:text-text-secondary underline underline-offset-2 cursor-pointer transition-colors', {
            innerText: Language.text('BTN_CLEAR').toLowerCase() || 'clear',
            onclick: () => { if (this.preset && typeof this.preset._clearForgeSelections === 'function') this.preset._clearForgeSelections(); }
        });
        clearRow.appendChild(clearLink);
        this.scrollWrapper.appendChild(clearRow);

        // [V18] Concurrent hydration. Each expander's render() appends its own node, so
        // DOM/visual order is fixed by construction order below — independent of which
        // async hydration settles first. Sync expanders (Strategy, Mode) are constructed
        // inline; their internal Storage.get().then() hydration already runs detached.
        // Settlement is CSS-flex-driven (reconcileGeometry is a no-op), so concurrent
        // mount carries no geometry risk.
        (async () => {
            try {
                this.persona      = new Persona(slots.persona);
                this.strategy     = new Strategy(slots.strategy);
                this.mode         = new Mode(slots.mode);
                this.protocols    = new Protocols(slots.protocols);
                this.imperative   = new Imperative(slots.imperative);
                this.attachment   = new Attachment(slots.attachment);
                this.intelligence = new Intelligence(slots.intelligence);
                this.metric       = new Metric(slots.metric);
                this.article      = new Article(slots.article);
                this.preset       = new Preset(slots.preset);
                this.directive    = new Directive(this.directiveWrapper);

                this.children.push(
                    this.persona, this.strategy, this.mode, this.protocols,
                    this.imperative, this.attachment, this.intelligence,
                    this.metric, this.article, this.preset, this.directive
                );

                // [V18.1] Persona is the hydration anchor: its render() populates
                // profile_intelligence into State, which Strategy._refreshPromoGate()
                // reads during its own (synchronous) render. Await it FIRST so the
                // sync expanders observe a hydrated profile, then parallelize the rest.
                await this.persona.render();

                // Synchronous expanders: construct-and-render, no promise to await.
                // [V18.2] Protocols.render() is synchronous (returns undefined); it belongs
                // here alongside Strategy/Mode, not inside Promise.all where it would
                // misrepresent the async contract.
                this.strategy.render();
                this.mode.render();
                this.protocols.render();

                log('UI', 'FORGE_HYDRATION_CONCURRENT', 'Dispatching parallel expander hydration.');

                // [V18.2] Async expanders with an awaitable render() contract hydrate
                // concurrently (Persona already settled above). Article and Preset now
                // expose async render() too, so FORGE_HYDRATION_SETTLED is a true
                // completeness signal for every async child.
                await Promise.all([
                    this.imperative.render(),
                    this.attachment.render(),
                    this.intelligence.render(),
                    this.metric.render(),
                    this.article.render(),
                    this.preset.render(),
                    this.directive.render()
                ]);

                log('UI', 'FORGE_HYDRATION_SETTLED', 'All Forge expanders hydrated.');
            } catch (error) {
                log('e', 'FORGE_MOUNT_FAILED', error);
                State.set('is_error', error);
            }
        })();

        log('UI', 'FORGE_RENDER', 'Forge orchestrator rendered components.');

        return this.container;
    }

    _handleManagementToggle(expanderId, isManaging) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') {
            log('UI', 'FORGE_RENDER_DEFERRED', 'User is typing, skipping full Forge re-render.');
            return;
        }

        if (isManaging) {
            const stateSnapshot = [];
            this.children.forEach(child => {
                if (child.expander && child.expander.id) {
                    stateSnapshot.push({
                        id: child.expander.id,
                        isExpanded: child.expander.isExpanded
                    });
                }
            });
            State.set('pre_management_expander_state', stateSnapshot);

            window.dispatchEvent(new CustomEvent('EXPANDER_DOMINANCE', { detail: { id: expanderId, isDominant: true } }));
            window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: expanderId, action: 'expand' } }));
        } else {
            window.dispatchEvent(new CustomEvent('EXPANDER_DOMINANCE', { detail: { id: expanderId, isDominant: false } }));

            const snapshot = State.get('pre_management_expander_state');
            if (snapshot) {
                snapshot.forEach(savedState => {
                    // FIX: Explicitly ignore the managing expander itself to prevent auto-reopen loops
                    if (savedState.id === expanderId) {
                        return;
                    }
                    const action = savedState.isExpanded ? 'expand' : 'collapse';
                    window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: savedState.id, action: action } }));
                });
                State.set('pre_management_expander_state', null);
            } else {
                window.dispatchEvent(new CustomEvent('EXPANDER', { detail: { id: expanderId, action: 'collapse' } }));
            }
        }
    }

    handleDominance(e) {
        if (e.detail.isDominant) {
            this.scrollWrapper.style.overflowY = 'hidden';
            if (this.directiveWrapper) this.directiveWrapper.classList.add('u-hidden');
        } else {
            this.scrollWrapper.style.overflowY = 'auto';
            if (this.directiveWrapper) this.directiveWrapper.classList.remove('u-hidden');
        }
    }

    destroy() {
        window.removeEventListener('UI_DOMINANCE_CHANGE', this.handleDominance);
        if (this.unsubPersonas) this.unsubPersonas();
        if (this.unsubMetrics)  this.unsubMetrics();
        if (this._directiveResizeObserver) this._directiveResizeObserver.disconnect();
        this.children.forEach(c => {
            if (typeof c.destroy === 'function') c.destroy();
        });
    }
}