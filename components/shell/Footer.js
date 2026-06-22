/**
 * @file components/shell/Footer.js
 * @purpose UI: Sovereign Action Gateway & Forensic Status Console.
 * @standard Specificity Bypass & Zombie Immunity Protocol.
 */
import { dom } from '../../utils/dom.js';
import { Language } from '../../services/Language.js';
import { ICONS } from '../../utils/assets.js';
import { Logger, log } from '../../utils/logger.js';
import { PromptCompiler } from '../../services/PromptCompiler.js';
import { Scraper } from '../../modules/Scraper.js';
import { Storage } from '../../services/Storage.js';
import { LLM } from '../../services/LLM.js';
import { State } from '../../services/State.js';
import { License } from '../../services/License.js';
import { IntelligenceService } from '../../services/PersonaLearningService.js';
import { ArticleMaterialsService } from '../../services/ArticleMaterialsService.js';
import { PermissionBroker } from '../../services/PermissionBroker.js';
import { UserConsole } from './UserConsole.js';

export class Footer {
    constructor(container) {
        // [V13.S³] Highlander Protocol: Autonomous Zombie Assassination
        if (window.__FOOTER_INSTANCE__) {
            window.__FOOTER_INSTANCE__.destroy();
        }
        window.__FOOTER_INSTANCE__ = this;

        this.instanceId = crypto.randomUUID();
        this.previousTab = 'Forge';
        this._isDestroyed = false;
        this.container = container;
        this.activeAspect = 'InfluenceCore';
        this.isDominant = false;
        this.isEditorActive = false;

        // Latching state for Expansion Vacuum
        this._lastValidAction = null;
        this._lastValidTimestamp = 0;
        
        this.userConsole = new UserConsole();
        this.handleGatewayClick = this.handleGatewayClick.bind(this);
        
        // [V13.S³] Highlander Matrix: Identity-Bound Subscriptions
        const sovereignKeys = [
            'active_tab',
            'is_managing_personas',
            'is_integrations_open',
            'is_managing_chars',
            'is_managing_archetypes',
            'is_managing_schemes'
        ];

        this._unsubs = sovereignKeys.map(key => 
            State.subscribe(key, () => this._sovereignResolve())
        );
        
        this.handleRefinement = this.handleRefinement.bind(this);
        this._getCompilerConfig = this._getCompilerConfig.bind(this);
        this.syncTimeout = null;
        this._unsubs.push(State.subscribe('is_managing_imperatives', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_imperative_editor_active', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_managing_attachments', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_attachment_editor_active', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_managing_peers', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_managing_intents', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_peer_expanded', () => this._sovereignResolve()));
         this._unsubs.push(State.subscribe('is_managing_articles', () => this._sovereignResolve()));
         this._unsubs.push(State.subscribe('is_article_editor_active', () => this._sovereignResolve()));
        // [V14] Metric Alchemy management mode + editor mutex — drive gateway label/action
        // and the global editor-active veto symmetrically with imperative/attachment/article.
        this._unsubs.push(State.subscribe('is_managing_metrics', () => this._sovereignResolve()));
        this._unsubs.push(State.subscribe('is_metric_editor_active', () => this._sovereignResolve()));
        // [V20] is_transmuting is the source of truth for the gateway button's disabled/label
        // posture (see _showGateway). Subscribe so an EXTERNAL clear of the flag — e.g. the
        // Waiting cover's Cancel resetting loading flags — re-resolves the gateway and reverts
        // the button out of its stuck "transmuting…" disabled state. Guarded to the false
        // transition so a transmute START does not overwrite the live "Transmuting…" caption.
        this._unsubs.push(State.subscribe('is_transmuting', (v) => { if (!v) this._sovereignResolve(); }));
        // [REQ-10] Re-resolve the gateway when an entity roster changes so the ⚗ Unseal cover
        // reconciles — it now CLEARS on a delete that drops the count below the free-tier limit.
        // [REQ-4] 'peers' included: peer creation is count-gated (free = 1) like the others.
        ['personas', 'imperatives', 'attachments', 'metrics', 'peers'].forEach(k =>
            this._unsubs.push(State.subscribe(k, () => this._sovereignResolve())));
       
        log('UI', 'FOOTER_INIT', { id: this.instanceId, status: 'Sovereign' });
    }

    /**
     * [V13.S³] Identity Seal: Assassinate Ghost instances before logic executes
     */
    _checkSovereignty() {
        if (this._isDestroyed) return false;
        if (window.__FOOTER_INSTANCE__ && window.__FOOTER_INSTANCE__ !== this) {
            log('LIFECYCLE', 'ZOMBIE_DETECTED', { id: this.instanceId, sovereign: window.__FOOTER_INSTANCE__.instanceId });
            this.destroy();
            return false;
        }
        return true;
    }

    _sovereignResolve() {
        if (this._resolveFrame) cancelAnimationFrame(this._resolveFrame);
        this._resolveFrame = requestAnimationFrame(() => {
            if (this._checkSovereignty()) this.resolveGatewayState();
        });
    }

    handleGatewayClick(e) {
        if (!this._checkSovereignty()) return;
        const action = this.actionBtn.dataset.action;
        log('LOGIC', 'GATEWAY_INVOKED', { action, instance: this.instanceId });
        // [PREMIUM] Hard gate (always) for premium entity creation; count gate (free = 1) for the rest.
        if (this._premiumBlocks(action)) {
            window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: action } }));
            log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: action });
            return;
        }
            
        if (action === 'persona:create') {
            window.dispatchEvent(new CustomEvent('CREATE_PERSONA_CLICKED'));
        } else if (action === 'imperative:create') {
            window.dispatchEvent(new CustomEvent('CREATE_IMPERATIVE_CLICKED'));
        } else if (action === 'attachment:upload') {
            window.dispatchEvent(new CustomEvent('ATTACHMENT_UPLOAD_CLICKED'));
        } else if (action === 'preset:create') {
            // [V16] Silent persona guard for preset creation — status-bar error only.
            this._guardPersonaThen(() => window.dispatchEvent(new CustomEvent('CREATE_PRESET_CLICKED')));
        } else if (action === 'char:create') {
            window.dispatchEvent(new CustomEvent('CREATE_CHAR_CLICKED'));
        } else if (action === 'archetype:create') {
            window.dispatchEvent(new CustomEvent('CREATE_ARCHETYPE_CLICKED'));
        } else if (action === 'scheme:create') {
            window.dispatchEvent(new CustomEvent('CREATE_SCHEME_CLICKED'));
        } else if (action === 'peer:create') {
            window.dispatchEvent(new CustomEvent('CREATE_PEER_CLICKED'));
        } else if (action === 'intent:create') {
            window.dispatchEvent(new CustomEvent('CREATE_INTENT_CLICKED'));
         } else if (action === 'article:create') {
             window.dispatchEvent(new CustomEvent('CREATE_ARTICLE_CLICKED'));
        } else if (action === 'metric:create') {
            // [V14] Gateway → Forge/Metric.js (Phase 10). Until Phase 10 lands, this event
            // has no subscriber; the action is still safe (no-op).
            window.dispatchEvent(new CustomEvent('CREATE_METRIC_CLICKED'));
        } else {
            this.handleTransmute();
        }
    }

    async _getCompilerConfig(overrideDirective = null) {
        return this.__getCompilerConfig(overrideDirective);
    }

    // [V16] Persona presence guard shared by preset:create (and any future creation gate).
    async _guardPersonaThen(fn) {
        const activeId = await Storage.get('personas_active_id');
        const personas = await Storage.get('personas') || [];
        if (!personas.find(p => p.id === activeId) || activeId === 'none') {
            log('LOGIC', 'NO_PERSONA_GUARD_TRIPPED', { context: 'preset:create' });
            Logger.userLog('ERR_NO_PERSONA', 'error');
            return;
        }
        fn();
    }

    async __getCompilerConfig(overrideDirective = null) {
         const storedConfig = await Storage.get('config') || {};
        return {
            interactionType: await Storage.get('interactionType') || 'rewrite',
            mode: await Storage.get('mode') || 'single',
            voidSourceAuditor: await Storage.get('void_source_auditor') !== false,
            imperatives: await Storage.get('imperatives') || [],
             personaKnowledgeThreshold: storedConfig.personaKnowledgeThreshold ?? 40,
            directive: overrideDirective || State.get('directive') || document.querySelector('#directive-input')?.value || ""
        };
    }

    render() {
        this.anchor = dom.create('div', 'footer-anchor');

        // 1. Action Gateway (Contextual Button)
        this.gateway = dom.create('div', 'action-gateway');
        this.actionBtn = dom.create('button', 'btn-transmute', {
            innerHTML: `${ICONS.FLASK} <span>${Language.text('TITLE_TRANSMUTE')}</span>`,
            onclick: this.handleGatewayClick
        });
        this.gateway.appendChild(this.actionBtn);

        this.anchor.appendChild(this.gateway);
        
        // 2. User Console (Status Bar & Forensic Overlay)
        const slot = dom.create('div', 'footer-console-slot w-full');
        this.anchor.appendChild(slot);

        this.container.appendChild(this.anchor);
        this.userConsole.mount(slot);

        this.bindEvents();
        this._sovereignResolve();
    }

    bindEvents() {
        this._onLogAdded = (e) => {
            if (!this._checkSovereignty()) return;
            const entry = e.detail;
            const isCopyEvent = entry && (entry.includes('[COPY_SUCCESS]') || entry.includes('SILENT_COPY'));
            const isLocked = Logger.isSyncLocked && Logger.isSyncLocked();

            if (entry && !isCopyEvent && !isLocked) {
                if (this.syncTimeout) clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => {
                    if (this._isDestroyed) return;
                    const activeNode = document.activeElement;
                    const userIsBusy = activeNode && ['INPUT', 'TEXTAREA'].includes(activeNode.tagName);
                    
                    if (userIsBusy || (Logger.isSyncLocked && Logger.isSyncLocked())) {
                        log('UI', 'SYNC_DEFERRED', 'User interaction active. Clipboard sync aborted.');
                        return;
                    }

                    const history = Logger.getHistory();
                    const wrapped = `---logs\n${history}\n---\n`;
                    const fallbackCopy = (text) => {
                        const textArea = document.createElement("textarea");
                        textArea.value = text;
                        textArea.style.position = "fixed";
                        textArea.style.left = "-9999px";
                        textArea.style.top = "0";
                        document.body.appendChild(textArea);
                        textArea.select();
                        try { document.execCommand('copy'); } catch (err) {}
                        document.body.removeChild(textArea);
                    };

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(wrapped).catch(() => fallbackCopy(wrapped));
                    } else {
                        fallbackCopy(wrapped);
                    }
                }, 2000);
            }
        };

        this._onAspectChange = (e) => {
            if (!this._checkSovereignty()) return;
            this.activeAspect = e.detail.id;
            this._sovereignResolve();
        };

        this._onTabSwitch = (e) => {
            if (!this._checkSovereignty()) return;
            this.activeTab = e.detail.id || e.detail.target;
            this._sovereignResolve();
        };

        this._onUiDominance = (e) => {
            if (!this._checkSovereignty()) return;
            this.isDominant = e.detail.isDominant;
            this._sovereignResolve();
        };

        this._onRefinementRequest = (e) => {
            if (!this._checkSovereignty()) return;
            this.handleRefinement(e.detail);
        };

        this._onMetricRecalibrate = (e) => {
            if (!this._checkSovereignty()) return;
            this.handleRefinement({ ...e.detail, isRecalibration: true });
        };

        this._onManagePersonasState = (e) => {
            if (!this._checkSovereignty()) return;
            this.activeAspect = e.detail.isManaging ? 'ManagePersonas' : 'InfluenceCore';
            this.isEditorActive = e.detail.isEditing;
            this._sovereignResolve();
        };

        window.addEventListener('LOG_ADDED', this._onLogAdded);
        window.addEventListener('ASPECT_CHANGE', this._onAspectChange);
        window.addEventListener('TAB_SWITCH', this._onTabSwitch);
        window.addEventListener('UI_DOMINANCE_CHANGE', this._onUiDominance);
        window.addEventListener('REFINEMENT_REQUEST', this._onRefinementRequest);
        window.addEventListener('METRIC_RECALIBRATE_REQUEST', this._onMetricRecalibrate);
        window.addEventListener('MANAGE_PERSONAS_STATE', this._onManagePersonasState);
        this._onLicenseChange = () => { if (this._checkSovereignty()) this._sovereignResolve(); };
        window.addEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);
        this._attachBodyObserver();
    }

    // [DOM-TRUTH] One observer drives physical-visibility settlement of every create-button. Its
    // target (#tab-content-viewport) survives tab switches; falls back to document.body if the
    // viewport is not yet mounted when the Footer binds.
    _attachBodyObserver() {
        if (this._bodyObserver) return;
        const target = document.getElementById('tab-content-viewport') || document.body;
        this._bodyObserver = new MutationObserver(() => this._sovereignResolve());
        this._bodyObserver.observe(target, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
        log('UI', 'FOOTER_BODY_OBSERVER_INIT', { target: target.id || 'body', instance: this.instanceId });
    }

    destroy() {
        this._isDestroyed = true;
        if (this._bodyObserver) { this._bodyObserver.disconnect(); this._bodyObserver = null; }
        if (this._resolveFrame) cancelAnimationFrame(this._resolveFrame);
        if (this._reconcileTimer) clearTimeout(this._reconcileTimer);
        if (this._latchTimeout) clearTimeout(this._latchTimeout);
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        
        window.removeEventListener('LOG_ADDED', this._onLogAdded);
        window.removeEventListener('ASPECT_CHANGE', this._onAspectChange);
        window.removeEventListener('TAB_SWITCH', this._onTabSwitch);
        window.removeEventListener('UI_DOMINANCE_CHANGE', this._onUiDominance);
        window.removeEventListener('REFINEMENT_REQUEST', this._onRefinementRequest);
        window.removeEventListener('METRIC_RECALIBRATE_REQUEST', this._onMetricRecalibrate);
        window.removeEventListener('MANAGE_PERSONAS_STATE', this._onManagePersonasState);
        if (this._onLicenseChange) window.removeEventListener('LICENSE_STATUS_CHANGED', this._onLicenseChange);

        if (this._unsubs) this._unsubs.forEach(u => u());
        if (window.__FOOTER_INSTANCE__ === this) window.__FOOTER_INSTANCE__ = null;
        log('LIFECYCLE', 'FOOTER_DESTROYED', { id: this.instanceId, status: 'Zombie Neutralized' });
    }
    
    async handleTransmute() {
        if (!this._checkSovereignty()) return;
        if (this.activeAspect === 'ManagePersonas') {
            window.dispatchEvent(new CustomEvent('REQUEST_CREATE_PERSONA'));
            return;
        }

        if (State.get('is_transmuting')) return;

        // Article generation reads user-supplied materials, not the live page — it never
        // exercises host access, so the per-origin gate is omitted for it.
        const _needsPageAccess = State.get('interactionType') !== 'article';
        if (_needsPageAccess) {
            const permitted = await PermissionBroker.ensurePermission();
            if (!permitted) {
                log('UI', 'TRANSMUTE_ABORTED_NO_PERMISSION');
                return;
            }
        }

        State.set('is_transmuting', true);
        
        this.actionBtn.classList.add('opacity-50', 'pointer-events-none');
        this.actionBtn.innerHTML = `<span>${Language.text('TRANSMUTING')}</span>`;
        
        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            const activeId = await Storage.get('personas_active_id');
            const personas = await Storage.get('personas') || [];
            // [V16] Silent persona guard — no persona selected -> status-bar error only, no further action.
            const persona = personas.find(p => p.id === activeId);
            if (!persona || activeId === 'none') {
                log('LOGIC', 'NO_PERSONA_GUARD_TRIPPED', { context: 'transmute' });
                Logger.userLog('ERR_NO_PERSONA', 'error');
                State.set('is_transmuting', false);
                if (this.actionBtn) {
                    this.actionBtn.classList.remove('opacity-50', 'pointer-events-none');
                    this.actionBtn.innerHTML = `${ICONS.FLASK} <span>${Language.text('TITLE_TRANSMUTE')}</span>`;
                }
                return;
            }
          
           const config = await this._getCompilerConfig();

             // [ARTICLE] Pre-flight gates for Long-form Article generation
             if (config.interactionType === 'article') {
                 const _articleId = State.get('active_article_id');
                 const _articles  = (await Storage.get('articles')) || [];
                 const _article   = _articles.find(a => a.id === _articleId);
                 if (!_article) {
                     log('LOGIC', 'ARTICLE_PREFLIGHT_FAIL', 'no_active');
                     State.set('is_transmuting', false);
                     State.set('is_error', new Error(Language.text('ERR_ARTICLE_NO_ACTIVE')));
                     return;
                 }
                 if (!Array.isArray(_article.materials) || _article.materials.length === 0) {
                     log('LOGIC', 'ARTICLE_PREFLIGHT_FAIL', 'no_materials');
                     State.set('is_transmuting', false);
                     State.set('is_error', new Error(Language.text('ERR_ARTICLE_NO_MATERIALS')));
                     return;
                 }
             }

             const context = _needsPageAccess
                 ? await Scraper.extract().catch(() => ({ ctrl_a_text: 'Fallback context.', context_structure: '' }))
                 : { ctrl_a_text: '', context_structure: '' };
            // [V18.9] Active set lives in the lightweight `attachments_active_ids` key (written
            // on apply and on content save). Fall back to legacy `.used` flags when the id-set
            // is absent (pre-migration data). Intersect against the heavy registry for content.
            const _reg = (await Storage.get('attachments_registry')) || [];
            const _activeIds = await Storage.get('attachments_active_ids');
            const attachments = Array.isArray(_activeIds)
                ? _reg.filter(a => _activeIds.includes(a.id))
                : _reg.filter(a => a.used);
            const input_payload = { persona, config: JSON.parse(JSON.stringify(config)), context, attachments };
            // [V14] Inject active user-defined metrics so PromptCompiler.compile() can emit
            // the <CUSTOM_METRICS> block (Phase 5) and extend SOVEREIGN_IDENTITY_SCHEMA's
            // "metrics" object with their keys (Phase 4). State.get('metrics') is the SoT —
            // CUSTOM_METRICS template self-filters to active:true; passing the full array is safe.
            input_payload.config.customMetrics = State.get('metrics') || [];
            log('AI', 'INPUT_OBJECT', input_payload);
            
            const prompt = PromptCompiler.compile(input_payload);
            const raw_response = await LLM.transmute(prompt.raw);
            // [ABORT-SETTLE] Cancel/suspend yields no payload — settle silently: skip unbox, record
            // creation and navigation. is_transmuting is cleared by the Cancel handler; the status-bar
            // warning is already emitted. No ErrorCover.
            if (raw_response == null) { log('w', 'TRANSMUTE_ABORT_SETTLED', {}); return; }
            const processed_json = LLM.unbox(raw_response);

            if (!this._checkSovereignty()) return;

            log('AI', 'OUTPUT_OBJECT', processed_json);
            
            const data = Array.isArray(processed_json) ? processed_json[0] : processed_json;
            // [V14.5] Per-persona learning gate. When the persona's learns_from_context is explicitly
            // false, skip the write-back entirely so no knowledge accumulates for that identity.
            // Treat undefined as ON for backwards-compat with pre-update personas.
            const _personaLearns = (input_payload.persona && input_payload.persona.learns_from_context !== false);
            if (data && _personaLearns && typeof IntelligenceService !== 'undefined' && IntelligenceService.processLearningUpdates) {
                if (input_payload.persona && input_payload.persona.id) {
                    State.set('active_persona_id', input_payload.persona.id);
                }
                
                this._lastPersonaResult = await IntelligenceService.processLearningUpdates(data, 'transmutation', {
                    personaId: input_payload.persona.id || State.get('active_persona_id')
                });
                
                const syncedPersonas = await Storage.get('personas');
                if (syncedPersonas) State.set('personas', syncedPersonas);
            } else if (data && !_personaLearns) {
                log('LOGIC', 'PERSONA_LEARNING_GATE', { gate: 'off', writeback: 'skipped', personaId: input_payload.persona?.id });
            }
           
            // [ARTICLE] Materials evolution (preparation branch only — article-generation skips this)
             if (config.interactionType !== 'article' && State.get('active_article_id') && data && ArticleMaterialsService) {
                 try {
                     const _articleResult = await ArticleMaterialsService.processMaterialsUpdates(data, 'transmutation');
                     this._lastArticleResult = _articleResult;
                     const _addedCount = (typeof _articleResult === 'number')
                         ? _articleResult
                         : (_articleResult && _articleResult.delta) || 0;
                     if (_addedCount > 0) {
                         window.dispatchEvent(new CustomEvent('TRANSMUTATION_NEW_MATERIALS', {
                             detail: { articleId: State.get('active_article_id'), addedCount: _addedCount }
                         }));
                     }
                 } catch (artErr) {
                     log('e', 'ARTICLE_MATERIALS_UPDATE_FAILED', artErr.message);
                 }
             }

            const STRATEGY_MAP = { 'rewrite': 'STRATEGY_REWRITE', 'comment': 'STRATEGY_COMMENT', 'reaction': 'STRATEGY_REACTION', 'article': 'STRATEGY_ARTICLE', 'promo': 'STRATEGY_PROMO' };
            const MODE_MAP = { 'single': 'MODE_SINGLE', 'matrix': 'MODE_MATRIX', 'nexus': 'MODE_NEXUS' };
           
             const _isArticleGen = (config.interactionType === 'article');
             const _articleForMeta = _isArticleGen
                 ? ((await Storage.get('articles')) || []).find(a => a.id === State.get('active_article_id'))
                 : null;
             const record = {
                id: crypto.randomUUID(),
                 kind: _isArticleGen ? 'article' : 'output',
                 articleId: _isArticleGen && _articleForMeta ? _articleForMeta.id : undefined,
                timestamp: Date.now(),
                config: JSON.parse(JSON.stringify(config)),
                output: processed_json,
                dna: _isArticleGen && _articleForMeta
                    ? { attributes: _articleForMeta.attributes }
                    : context,
                 meta: _isArticleGen && _articleForMeta ? {
                     personaName: persona.name,
                     articleTitle: _articleForMeta.attributes && _articleForMeta.attributes.title,
                     narrativeModel: _articleForMeta.attributes && _articleForMeta.attributes.narrativeModel
                 } : {
                    personaName: persona.name,
                    personaDescription: persona.desc || 'Dominant Core Intent.',
                    strategyLabel: Language.text(STRATEGY_MAP[config.interactionType] || 'STRATEGY_REWRITE'),
                    modeLabel: Language.text(MODE_MAP[config.mode] || 'MODE_SINGLE')
                }
            };
           
             const _routeKey  = _isArticleGen ? 'libraryArticles' : 'currentOutputs';
             const _routeTab  = _isArticleGen ? 'Library' : 'Sanctuary';
             const _routeEvt  = _isArticleGen ? 'library:articles-updated' : 'alchimist:outputs-updated';
             const _routeRecs = (await Storage.get(_routeKey)) || [];
             _routeRecs.push(record);
             await Storage.set({ [_routeKey]: _routeRecs });
             log('LOGIC', 'ROUTE_TRANSMUTE_OUTPUT', { kind: record.kind, target: _routeKey });
             log('DATA', 'STORAGE_SYNC', { id: record.id, collection: _routeKey });
           
            if (config.directive) {
                window.dispatchEvent(new CustomEvent('alchimist:commit-directive', { detail: config.directive }));
            }

            window.dispatchEvent(new CustomEvent('TRANSMUTATION_SUCCESS'));

            // [FIX] Only register a Sanctuary focus target for records that land in
            // currentOutputs. Article generations route to libraryArticles; setting this
            // would leave a stale id that blanks Sanctuary on its next hydration.
            if (!_isArticleGen) window.__alchimistExpectedRecordId = record.id;
             window.dispatchEvent(new CustomEvent(_routeEvt, { detail: { lastRecordId: record.id } }));
             window.dispatchEvent(new CustomEvent('ui:request-tab-switch', { detail: { tab: _routeTab } }));

            // [ARTIFACTS] Surface added/synthesized data to UserConsole BEFORE the log emission
            const _artifactsPayload = {
                persona: (this._lastPersonaResult && (this._lastPersonaResult.added || this._lastPersonaResult.synthesized))
                    ? { added: this._lastPersonaResult.added || [], synthesized: this._lastPersonaResult.synthesized || [] }
                    : null,
                article: (this._lastArticleResult && typeof this._lastArticleResult === 'object' && (this._lastArticleResult.added || this._lastArticleResult.synthesized))
                    ? { added: this._lastArticleResult.added || [], synthesized: this._lastArticleResult.synthesized || [] }
                    : null
            };
            const _hasArtifacts = !!(
                (_artifactsPayload.persona && (_artifactsPayload.persona.added.length || _artifactsPayload.persona.synthesized.length)) ||
                (_artifactsPayload.article && (_artifactsPayload.article.added.length || _artifactsPayload.article.synthesized.length))
            );
            if (_hasArtifacts) {
                window.dispatchEvent(new CustomEvent('TRANSMUTATION_ARTIFACTS', { detail: { payload: _artifactsPayload } }));
            }
            this._lastPersonaResult = null;
            this._lastArticleResult = null;

            Logger.userLog('LOG_SUC_TRANSMUTE', 'success');
            log('LOGIC', 'TRANSMUTE', Language.text('MSG_TRANSMUTE_SUCCESS'));
            window.dispatchEvent(new CustomEvent('TRANSMUTATION_SUCCESS'));
            
            setTimeout(() => {
                if (State.get('is_transmuting')) State.set('is_transmuting', false);
            }, 3000);
        } catch (err) { 
            log('e', 'TRANSMUTE_ERROR', err.message); 
            State.set('is_transmuting', false); 
            State.set('is_error', err);
        } finally { 
            if (this.actionBtn) {
                this.actionBtn.classList.remove('opacity-50', 'pointer-events-none'); 
                this.actionBtn.innerHTML = `${ICONS.FLASK} <span>${Language.text('TITLE_TRANSMUTE')}</span>`; 
            }
        }
    }

    async handleRefinement(payload) {
        if (!this._checkSovereignty()) return;
        if (State.get('is_transmuting')) return;
        State.set('is_transmuting', true);
        
        const targetId = payload.originalRecordId || payload.originalId || payload.recordId || payload.original?.id || payload.id;
        log('UI', 'REFINEMENT_START', { id: targetId });
        
        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            const activeId = await Storage.get('personas_active_id');
            const personas = await Storage.get('personas') || [];
            const persona = personas.find(p => p.id === activeId) || { id: 'fallback', name: 'Fallback', prompt: '' };

            const records = await Storage.get('currentOutputs') || [];
             let sourceKey = 'currentOutputs';
             let workingRecords = records;
             let targetIdx = records.findIndex(r => r.id === targetId);

             if (targetIdx === -1) {
                 // [ARTICLE] Polymorphic source lookup: try libraryArticles
                 const _libRecs = (await Storage.get('libraryArticles')) || [];
                 const _libIdx  = _libRecs.findIndex(r => r.id === targetId);
                 if (_libIdx !== -1) {
                     sourceKey = 'libraryArticles';
                     workingRecords = _libRecs;
                     targetIdx = _libIdx;
                 }
             }
             if (targetIdx === -1) {
                log('w', 'REFINEMENT', `Original record lost in substrate. ID: ${targetId}. Aborting.`);
                return;
            }

             const originalRecord = workingRecords[targetIdx];
            
            const config = JSON.parse(JSON.stringify(originalRecord.config || await this._getCompilerConfig(payload.directive)));
            if (payload.directive) config.directive = payload.directive;

            const context = originalRecord.dna || await Scraper.extract().catch(() => ({ ctrl_a_text: 'Fallback context.', context_structure: '' }));
            
            // [V18.9] Mirror of the transmute intersection (see input_payload path above).
            const _reg2 = (await Storage.get('attachments_registry')) || [];
            const _activeIds2 = await Storage.get('attachments_active_ids');
            const attachments = Array.isArray(_activeIds2)
                ? _reg2.filter(a => _activeIds2.includes(a.id))
                : _reg2.filter(a => a.used);
            const input_payload = { 
                persona, 
                config: JSON.parse(JSON.stringify(config)), 
                context,
                attachments,
                refinement: {
                    originalId: targetId,
                    suggestion: payload.isRecalibration 
                        ? `Recalibrate ${payload.metricName} from ${payload.oldValue} to ${payload.newValue} (range is 0-100)` 
                        : payload.suggestion,
                    targetText: Storage.get_context_truth(targetId) || originalRecord.output?.[0]?.text || originalRecord.output?.text,
                    targetIdx: payload.targetIdx || 0,
                    mood: payload.mood || 'Neutral'
                },
                recalibration: payload.isRecalibration ? {
                    metricName: payload.metricName,
                    oldValue: payload.oldValue,
                    newValue: payload.newValue,
                    // [V14] Forwarded from Sanctuary.Metrics.dispatchRecalibration (Phase 3) —
                    // tells SOVEREIGN_IDENTITY_SCHEMA (Phase 4) whether the recalibrated metric
                    // is custom-defined or AI-defined, so the value gets pinned to the right key.
                    isCustomMetric: payload.isCustomMetric === true
                } : null
            };
            // [V14] Inject active user-defined metrics so PromptCompiler can emit <CUSTOM_METRICS>
            // (Phase 5) for ALL refinement variants — suggestion-apply, length-adjust, recalibration.
            input_payload.config.customMetrics = State.get('metrics') || [];

            const prompt = PromptCompiler.compile(input_payload);
            const raw_response = await LLM.transmute(prompt.raw);
            // [ABORT-SETTLE] No payload on cancel/suspend — do NOT overwrite the existing record's
            // .output with null. Settle silently.
            if (raw_response == null) { log('w', 'REFINEMENT_ABORT_SETTLED', {}); State.set('is_transmuting', false); return; }
            const processed_json = LLM.unbox(raw_response);
        
            if (!this._checkSovereignty()) return;

            log('AI', 'OUTPUT_OBJECT', processed_json);

            const data = Array.isArray(processed_json) ? processed_json[0] : processed_json;
            if (data && typeof IntelligenceService !== 'undefined' && IntelligenceService.processLearningUpdates) {
                if (input_payload.persona && input_payload.persona.id) {
                    State.set('active_persona_id', input_payload.persona.id);
                }
                
                await IntelligenceService.processLearningUpdates(data, 'refinement');
                
                const syncedPersonas = await Storage.get('personas');
                if (syncedPersonas) State.set('personas', syncedPersonas);
            }

            workingRecords[targetIdx].output = processed_json;
            workingRecords[targetIdx].timestamp = Date.now(); 
            workingRecords[targetIdx].meta = {
                ...workingRecords[targetIdx].meta,
                lastSuggestion: payload.suggestion,
                isRefined: true
            };

             await Storage.set({ [sourceKey]: workingRecords });
             const _refEvent = sourceKey === 'libraryArticles' ? 'library:articles-updated' : 'alchimist:outputs-updated';
             window.dispatchEvent(new CustomEvent(_refEvent, { detail: { lastRecordId: targetId } }));
            log('LOGIC', 'REFINEMENT', Language.text('MSG_TRANSMUTE_SUCCESS'));
            
            setTimeout(() => {
                if (State.get('is_transmuting')) State.set('is_transmuting', false);
            }, 3000);

        } catch (err) {
            log('e', 'REFINEMENT_ERROR', err.message);
            Logger.userLog(payload.isRecalibration ? 'LOG_ERR_RECALIBRATE' : 'LOG_ERR_SUGGESTION', 'error');
            State.set('is_transmuting', false);
            State.set('is_error', err);
        } finally {
        }
    }

    resolveGatewayState() {
        if (!this._checkSovereignty()) return;

        const tab = State.get('active_tab');

        // [V20] Reconcile the dominance latch against the live DOM before gating the
        // transmute arm below. this.isDominant is written ONLY by UI_DOMINANCE_CHANGE,
        // which fires solely from Expander.setDominantMode(). Several exit paths release
        // management mode WITHOUT the expander ever collapsing itself — e.g.
        // AlchemyService.integrateMetric() sets is_managing_metrics=false directly, and
        // Forge._handleManagementToggle() deliberately skips collapsing the managing
        // expander during snapshot restore. In those paths setDominantMode(false) never
        // runs, no release event is emitted, and the latch stays stuck true — suppressing
        // 'alchemy:transmute' even though nothing is actually dominant. The dominant
        // expander always carries .expandable-container--dominant (removed synchronously
        // on collapse), so the DOM is the source of truth here.
        const _domDominant = !!document.querySelector('.expandable-container--dominant');
        if (this.isDominant !== _domDominant) {
            log('UI', 'DOMINANCE_LATCH_RECONCILED', { latched: this.isDominant, actual: _domDominant, instance: this.instanceId });
            this.isDominant = _domDominant;
        }

        // [V13.S³] Holistic Context Transition: Immediate Latch Invalidation
        // Prevents actions from Forge or Features from leaking into the Sanctuary.
        if (this.previousTab !== tab) {
            this._lastValidAction = null;
            this._lastValidTimestamp = 0;
            this.previousTab = tab;
            if (this._latchTimeout) clearTimeout(this._latchTimeout);
        }

        const editors = State.get('active_editors') || {};

        // Global Veto
        const isEditorActive = this.isEditorActive ||
                             State.get('is_char_editor_active') ||
                             State.get('is_archetype_editor_active') ||
                             State.get('is_scheme_editor_active') ||
                             State.get('is_attachment_editor_active') ||
                             State.get('is_imperative_editor_active') ||
                             State.get('is_preset_editor_active') ||
                              State.get('is_article_editor_active') ||
                             // [V14] Metric editor participates in the global veto so the
                             // gateway hides while the user is editing a metric name/desc.
                             State.get('is_metric_editor_active') ||
                             editors.active;

        let targetAction = null;
        let targetLabel = '';

        if (tab === 'Forge') {
            this._showAnchor();
            if (this.activeAspect === 'ManagePersonas') {
                targetAction = 'persona:create';
                targetLabel = Language.text('TITLE_CREATE_PERSONA');
            } else if (this._mgmtVisible('is_managing_imperatives', 'exp-imperative')) {
                targetAction = 'imperative:create';
                targetLabel = Language.text('FOOTER_ACTION_IMPERATIVE') || 'Create Imperative';
            } else if (this._mgmtVisible('is_managing_attachments', 'exp-attachment')) {
                targetAction = 'attachment:upload';
                targetLabel = Language.text('FOOTER_ACTION_UPLOAD') || 'upload file';
            } else if (this._mgmtVisible('is_managing_presets', 'exp-preset')) {
                targetAction = 'preset:create';
                targetLabel = Language.text('FOOTER_ACTION_PRESET') || 'Create Preset';
             } else if (this._mgmtVisible('is_managing_articles', 'exp-article')) {
                targetAction = 'article:create';
                 targetLabel = Language.text('FOOTER_ACTION_ARTICLE') || 'Create Article';
            } else if (this._mgmtVisible('is_managing_metrics', 'exp-metric')) {
                // [V14] Slotted after articles, before the fallback transmute arm — matches
                // the audit §7.5 GATEWAY_ROUTING extension. FOOTER_ACTION_METRIC was added
                // to Language.js in Phase 1.
                targetAction = 'metric:create';
                targetLabel = Language.text('FOOTER_ACTION_METRIC') || 'Create Metric';
            } else if (!this.isDominant) {
                targetAction = 'alchemy:transmute';
                targetLabel = Language.text('TITLE_TRANSMUTE');
            }
        } 
        else if (tab === 'Features') {
            if (State.get('is_integrations_open')) {
                this._showAnchor();
                if (this._mgmtVisible('is_managing_chars', 'exp-chars')) {
                    targetAction = 'char:create';
                    targetLabel = Language.text('BTN_CREATE_CHAR') || '+create char';
                } else if (this._mgmtVisible('is_managing_archetypes', 'exp-archetypes')) {
                    targetAction = 'archetype:create';
                    targetLabel = Language.text('BTN_CREATE_ARCHETYPE') || '+create archetype';
                } else if (this._mgmtVisible('is_managing_schemes', 'exp-schemes')) {
                    targetAction = 'scheme:create';
                    targetLabel = Language.text('BTN_CREATE_SCHEME') || '+create scheme';
                }
            } else if (this._mgmtVisible('is_managing_peers', 'exp-peers')) {
                this._showAnchor();
                if (!State.get('is_peer_expanded')) {
                    targetAction = 'peer:create';
                    targetLabel = Language.text('BTN_CREATE_PEER') || 'create peer';
                }
            } else if (this._mgmtVisible('is_managing_intents', 'exp-intents')) {
                this._showAnchor();
                targetAction = 'intent:create';
                targetLabel = Language.text('BTN_CREATE_INTENT') || 'create intent';
            }
        }

        // Sovereign Latching Logic
        const now = Date.now();
        if (targetAction) {
            this._lastValidAction = { targetAction, targetLabel };
            this._lastValidTimestamp = now;
            if (this._latchTimeout) clearTimeout(this._latchTimeout);
        } else if (this._lastValidAction && (now - this._lastValidTimestamp < 300)) {
            targetAction = this._lastValidAction.targetAction;
            targetLabel = this._lastValidAction.targetLabel;
            
            // [V13.S³] Self-Extinguishing Latch: 
            // Forces a final check once the 300ms window expires to ensure button hides.
            if (this._latchTimeout) clearTimeout(this._latchTimeout);
            this._latchTimeout = setTimeout(() => this._sovereignResolve(), 310);
        }

        if (targetAction && !isEditorActive) {
            this._showGateway(targetAction, targetLabel);
        } else {
            this._hideAnchor();
            this._hideGateway(isEditorActive ? (Language.text('GATEWAY_STATUS_EDITOR_ACTIVE') || 'Editor Active') : `${Language.text('GATEWAY_STATUS_NO_INTENT') || 'No Intent: '}${tab}`);
        }
    }

    // [DOM-TRUTH] Physical visibility of an expander body. Self-collapse sets the body opacity:0;
    // ancestor-collapse propagates opacity:0 down the chain — checkVisibility walks ancestors, so a
    // child (exp-peers) reads hidden when its parent (exp-intelligence) collapses.
    _isExpanderBodyVisible(expId) {
        const el = document.getElementById(expId);
        if (!el) return false;
        const body = el.querySelector(':scope > .expandable-body');
        if (!body) return false;
        if (typeof body.checkVisibility === 'function') {
            return body.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
        }
        return el.classList.contains('is-expanded') && el.offsetParent !== null;
    }

    // [DOM-TRUTH] A management flag is honored only while its expander body is physically visible.
    // Gating at SELECTION (not post-hoc) lets a stuck-true flag fall through to the correct fallback
    // (e.g. the Forge transmute arm) instead of collapsing the gateway to "no action".
    _mgmtVisible(flagKey, expId) {
        if (!State.get(flagKey)) return false;
        const visible = this._isExpanderBodyVisible(expId);
        if (!visible) log('UI', 'GATEWAY_DOM_TRUTH_RECONCILED', { flag: flagKey, expId, visible: false });
        return visible;
    }

    _hideAnchor() {
        if (!this.anchor) return;
        this.anchor.classList.add('u-hidden');
    }

    _showAnchor() {
        if (!this.anchor) return;
        this.anchor.classList.remove('u-hidden');
    }

    _showGateway(action, label) {
        if (!this.actionBtn || !this.gateway) return;
        const plusIcon = action === 'alchemy:transmute' 
            ? ICONS.FLASK 
            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        
        // [IDEMPOTENT MANIFEST] The DOM-truth MutationObserver re-resolves the gateway on every viewport
        // mutation, including the focus/blur class churn a click itself causes. Rewriting innerHTML on each
        // pass destroys/recreates the button's child nodes; if that lands between the user's mousedown and
        // mouseup the native click is swallowed (press/release on different nodes) — the "needs 2-3 clicks"
        // symptom. Rewrite the icon/label only on a real change. handleTransmute's manual "Transmuting…"
        // swap restores to this same label, so the cached value never displays stale content.
        if (this.actionBtn.dataset.action !== action || this._lastGatewayLabel !== label) {
            this.actionBtn.innerHTML = `${plusIcon} <span>${label}</span>`;
            this.actionBtn.dataset.action = action;
            this._lastGatewayLabel = label;
            log('UI', 'GATEWAY_MANIFEST', { action, instance: this.instanceId });
        }

        // [V16] Reconcile enabled/disabled state on every manifest. The disabled classes are added
        // when a transmute starts (and removed in its finally), but if that flow navigates away
        // mid-transmute — e.g. LLM.transmute redirecting to Config on a missing API key — the
        // gateway can re-manifest on return to Forge while the button still carries the stale
        // disabled classes. Source of truth is is_transmuting: only an in-flight transmute keeps
        // the button disabled; otherwise it is always re-enabled here, in all exit paths.
        if (State.get('is_transmuting')) {
            this.actionBtn.classList.add('opacity-50', 'pointer-events-none');
        } else {
            this.actionBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
        
        this.gateway.classList.remove('action-gateway--hidden');

        // [V21] Occlusion Purge: the gateway is sovereign and survives navigation, so an
        // inline display/visibility occlusion stamped on .btn-transmute by a transient
        // dominance/occlusion path — whose release is skipped when its owner is destroyed
        // on tab-switch — outlives that path and defeats this class-based show. An inline
        // !important cannot be undone by toggling a parent class. _showGateway is reached
        // ONLY when the gateway is genuinely meant to be visible, so clear any stale inline
        // occlusion here. Guarded + idempotent (removeProperty is a no-op once cleared), so
        // the body-observer's style-mutation pass does not loop.
        if (this.actionBtn.style.display || this.actionBtn.style.visibility) {
            this.actionBtn.style.removeProperty('display');
            this.actionBtn.style.removeProperty('visibility');
            log('UI', 'GATEWAY_OCCLUSION_PURGED', { action, instance: this.instanceId });
        }
        this._reconcileGatewayPremiumCover(action);
    }

    _hideGateway(reason = 'unknown') {
        if (!this.gateway) return;
        this.gateway.classList.add('action-gateway--hidden');
        log('UI', 'GATEWAY_HIDDEN', { reason, instance: this.instanceId });
    }

    _premiumBlocks(action) {
        if (License.isPremium()) return false;
        const HARD = ['char:create', 'archetype:create', 'intent:create'];
        if (HARD.includes(action)) return true;
        if (action === 'persona:create') {
            // Free tier: one user-created persona allowed; seeded/default/bundle personas don't count.
            const personas = State.get('personas') || [];
            return personas.filter(p => p && p.userCreated).length >= 1;
        }
        const COUNT = { 'imperative:create': 'imperatives', 'attachment:upload': 'attachments', 'metric:create': 'metrics', 'peer:create': 'peers' };
        const key = COUNT[action];
        if (key) return ((State.get(key) || []).length >= 1);
        return false;
    }

    _reconcileGatewayPremiumCover(action) {
        const blocked = this._premiumBlocks(action);
        if (blocked && this.gateway) {
            this.gateway.style.position = 'relative';
            if (!this._premiumCoverEl) {
                this._premiumCoverEl = dom.create('div', 'gateway-premium-cover', {
                    style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(5,5,7,0.72);z-index:10;border-radius:inherit;'
                });
                this._premiumCoverEl.innerHTML = `<span style="padding:3px 12px;font-size:11px;font-weight:800;color:#0a0a0a;background:linear-gradient(90deg,#d4af37,#f0c75e);border-radius:9999px;white-space:nowrap;">${Language.text('BTN_PREMIUM') || '⚗ Unseal'}</span>`;
                this.gateway.appendChild(this._premiumCoverEl);
            }
            this._premiumCoverEl.onclick = (e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('PREMIUM_GATE_OPEN', { detail: { actionId: action } }));
                log('UI', 'PREMIUM_ACTION_BLOCKED', { actionId: action });
            };
            this._premiumCoverEl.style.display = 'flex';
        } else if (this._premiumCoverEl) {
            this._premiumCoverEl.style.display = 'none';
        }
    }
}