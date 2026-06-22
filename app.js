/**
 * @file app.js
 * @purpose VOLATILE CORE: Entry point for Side Panel initialization.
 */
import { log, Logger } from './utils/logger.js';
import { Language } from './services/Language.js';
import { TopPane } from './components/shell/TopPane.js';
import { MainContentArea } from './components/shell/MainContentArea.js';
import { Footer } from './components/shell/Footer.js';
import { Waiting } from './components/reusable/Waiting.js';
import { ErrorCover } from './components/reusable/ErrorCover.js';
import { PremiumCover } from './components/reusable/PremiumCover.js';
import { Targeting } from './components/reusable/Targeting.js';
import { State } from './services/State.js';
import { Storage } from './services/Storage.js';
import { License } from './services/License.js';
import { MemoryService } from './services/MemoryService.js';
import { Tester } from './services/Tester.js';
import { WelcomeScreen } from './components/tutorial/WelcomeScreen.js';
import { DEFAULT_PERSONAS, DEFAULT_CHARS, DEFAULT_ARCHETYPES, DEFAULT_INTENTS, BUNDLES } from './utils/assets.js';
import { Bundles } from './components/core/Bundles.js';
// [CWS] Compliance Sovereign Globals (WP-4): consent gate, permission broker, attribution badge.
import { Consent } from './components/core/Consent.js';
import { PermissionBroker } from './services/PermissionBroker.js';
import { Disclosure } from './components/reusable/Disclosure.js';

/**
 * Phoenix Shell: The Volatile Resurrection
 */
const Phoenix = {
    hotSwap() {
        log('w', 'PHOENIX_INIT', Language.text('MSG_PHOENIX_INCINERATING'));
        if (typeof window.Logger !== 'undefined' && window.Logger.clear) window.Logger.clear();
        location.reload();
    }
};

window.refresh = () => Phoenix.hotSwap();

window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        Phoenix.hotSwap();
    }
});

// Detect storage limit on first boot
MemoryService.checkMemoryCapacity();
MemoryService.init();

 // [FOX_ISSUE.FIX.V2] Global Event Throttler for State Storms
 let _hydrationLock = false;
 window.addEventListener('PERSONA_SORT_HYDRATED', (e) => {
     if (_hydrationLock) e.stopImmediatePropagation();
     _hydrationLock = true;
     setTimeout(() => { _hydrationLock = false; }, 100);
 }, true);

window.test_bridge = {
    'influence core tabs': async () => {
        const tabs = ['Sanctuary', 'Forge'];
        let i = 0;
        const interval = setInterval(() => {
            const btn = document.querySelector(`[data-tab-id="${tabs[i % 2]}"]`);
            if (btn) btn.click();
            i++;
            if (i >= 4) {
                clearInterval(interval);
                log('LOGIC', 'TEST', 'Tab test sequence complete.');
            }
        }, 800);
    },
    'layout metrics': async () => {
        const root = document.getElementById('app-root');
        if (!root) return;
        const rootH = Math.round(root.getBoundingClientRect().height);
        const childrenH = Array.from(root.children).reduce((acc, child) => acc + Math.round(child.getBoundingClientRect().height), 0);
        const ok = rootH === childrenH && root.scrollHeight === root.clientHeight;
        log(ok ? 'LOGIC' : 'e', 'TEST', ok ? `Integrity: OK (${rootH}px)` : `CRITICAL FRACTURE: Root: ${rootH}px`);
    },
    'strategy selection sync chain': async () => {
        log('LOGIC', 'TEST', 'Starting Strategy Sync Chain Test...');
        
        // 1. Expand
        const expander = document.querySelector('#exp-strategy');
        const header = expander?.querySelector('.expandable-header');
        if (header) header.click();
        
        // 2. Select (Wait for animation)
        setTimeout(async () => {
            const items = expander.querySelectorAll('.selector-item');
            const target = Array.from(items).find(el => el.innerText.includes('Comment')) || items[1];
            if (target) target.click();
            
            // 3. Verify Storage
            const stored = await Storage.get('interactionType');
            const success = stored === 'comment';
            log('LOGIC', 'TEST', `Strategy Sync Result: ${success ? 'PASSED' : 'FAILED'} (Value: ${stored})`);
        }, 500);
    },
    'mode selection integrity gate': async () => {
        log('LOGIC', 'TEST', 'Starting Mode Selection Integrity Gate Test...');
        
        const expander = document.querySelector('#exp-mode');
        const header = expander?.querySelector('.expandable-header');
        if (header) header.click();
        
        setTimeout(async () => {
            const items = expander.querySelectorAll('.selector-item');
            // Target 'Matrix'
            const target = Array.from(items).find(el => el.innerText.includes('Matrix')) || items[1];
            if (target) target.click();
            
            const stored = await Storage.get('mode');
            const success = stored === 'matrix';
            log('LOGIC', 'TEST', `Mode Sync Result: ${success ? 'PASSED' : 'FAILED'} (Value: ${stored})`);
        }, 500);
    },
    'forge:sovereign_swap': async () => {
        log('LOGIC', 'TEST', 'Starting Sovereign Swap Test...');
        const strategyExp = document.querySelector('#exp-strategy');
        const modeExp = document.querySelector('#exp-mode');
        
        strategyExp?.querySelector('.expandable-header')?.click();
        
        setTimeout(() => {
            const isStrategyDominant = strategyExp.classList.contains('expandable-container--dominant');
            const isFooterHidden = document.querySelector('.footer-anchor').classList.contains('u-hidden');
            log('LOGIC', 'TEST', `Strategy Dominance: ${isStrategyDominant && isFooterHidden ? 'PASSED' : 'FAILED'}`);
            
            modeExp?.querySelector('.expandable-header')?.click();
            
            setTimeout(() => {
                const isStrategyCollapsed = !strategyExp.classList.contains('expandable-container--dominant');
                const isModeDominant = modeExp.classList.contains('expandable-container--dominant');
                log('LOGIC', 'TEST', `Sovereign Swap: ${isStrategyCollapsed && isModeDominant ? 'PASSED' : 'FAILED'}`);
                
                modeExp?.querySelector('.expandable-header')?.click();
                
                setTimeout(() => {
                    const isFooterVisible = !document.querySelector('.footer-anchor').classList.contains('u-hidden');
                    const isModeCollapsed = !modeExp.classList.contains('expandable-container--dominant');
                    log('LOGIC', 'TEST', `Layout Restoration: ${isFooterVisible && isModeCollapsed ? 'PASSED' : 'FAILED'}`);
                }, 500);
            }, 500);
        }, 500);
    },
    'persona selection sync chain': async () => {
        log('LOGIC', 'TEST', 'Starting Persona Sync Chain Test...');
        
        const expander = document.querySelector('#exp-persona');
        const header = expander?.querySelector('.expandable-header');
        if (header) header.click();
        
        setTimeout(async () => {
            const items = expander.querySelectorAll('.selector-item');
            // Target 'Noir Detective'
            const target = Array.from(items).find(el => el.innerText.includes('Noir'));
            if (target) target.click();
            
            const stored = await Storage.get('personas_active_id');
            const success = stored === 'noir-detective';
            log('LOGIC', 'TEST', `Persona Sync Result: ${success ? 'PASSED' : 'FAILED'} (Value: ${stored})`);
        }, 500);
    },
    'forge:dominant_geometry_settlement': async () => {
        log('LOGIC', 'TEST', 'Starting Dominant Geometry Settlement Test...');
        const forgeContainer = document.querySelector('#forge-container');
        const expander = document.querySelector('#exp-persona');
        
        expander?.querySelector('.expandable-header')?.click(); // Expand to dominant
        
        setTimeout(() => {
            const body = expander.querySelector('.expandable-body');
            const header = expander.querySelector('.expandable-header');
            const targetBodyH = forgeContainer.clientHeight - header.offsetHeight;
            
            const bodyIsCorrect = parseInt(body.style.height) === targetBodyH;
            const overflowIsAuto = body.style.overflowY === 'auto';
            
            log('LOGIC', 'TEST', `Geometry Lock: ${bodyIsCorrect && overflowIsAuto ? 'PASSED' : 'FAILED'} (Target: ${targetBodyH}px, Actual: ${body.style.height})`);
        }, 100);
    },
    'forge:geometric_forensics': async () => {
        log('LOGIC', 'TEST', 'Starting Geometric Forensics Test...');
        const getH = (sel) => document.querySelector(sel)?.clientHeight || document.querySelector(sel)?.offsetHeight || 0;
        
        const expander = document.querySelector('#exp-persona');
        expander?.querySelector('.expandable-header')?.click();
        
        setTimeout(() => {
            const metrics = {
                window_h: window.innerHeight,
                app_root_h: getH('#app-root'),
                main_content_h: getH('#main-content'),
                viewport_h: getH('#tab-content-viewport'),
                top_pane_h: getH('#top-pane-container'),
                footer_h: getH('.footer-anchor')
            };
            
            // Approx ideal Forge height (Window - TopPane - Footer - TabBar(approx 36))
            const ideal = metrics.window_h - metrics.top_pane_h - metrics.footer_h - 36;
            
            log('DATA', 'FORENSICS', JSON.stringify(metrics));
            log('DATA', 'IDEAL_VS_ACTUAL', JSON.stringify({ ideal, actual: metrics.viewport_h }));
            log('DATA', 'GEOMETRY_TRACE', `Please copy these logs for the next audit step.`);
        }, 500);
    }
};

/**
 * app.initiate()
 * Deterministic boot sequence for the Alchimist Refactored.
 */
async function initiate() {
    // [PREMIUM] Hydrate license tier before any component mounts (closes cold-start gate race).
    await License.init();

    // Substrate Migration: Category to Tags
    const existingPersonas = await Storage.get('personas');
    if (existingPersonas && Array.isArray(existingPersonas)) {
        let mutated = false;
        const migrated = existingPersonas.map(p => {
            if (p.category) {
                mutated = true;
                p.tags = [p.category];
                delete p.category;
                log('DATA', 'PERSONA_MIGRATION', { id: p.id, from: 'category', to: 'tags' });
            }
            return p;
        });
        if (mutated) await Storage.set({ personas: migrated });
    }

    // First-Run Replication Check
    const isInit = await Storage.get('is_initialized');
    if (!isInit) {
        log('DATA', 'STORAGE', 'Replicating full persona substrate...');
        await Storage.set({
            personas: DEFAULT_PERSONAS,
            personas_active_id: 'viral-storyteller',
            void_source_auditor: true,
            is_initialized: true
        });
        // [V16] Default bundle is applied on first init — seed every substrate the default bundle
        // owns (chars/archetypes/intents) so they exist as real data from boot. The R-1 re-seed
        // gate in Char/Archetype/Intents loadItems no longer resurrects defaults post-revoke, so
        // first-run must write them explicitly here.
        await Storage.set({
            feature_chars: DEFAULT_CHARS,
            feature_archetypes: DEFAULT_ARCHETYPES,
            intents: DEFAULT_INTENTS
        });
        await Storage.set({ applied_bundle_ids: ['bundle-default'], bundles_default_seeded: true });
    } else {
        // [V16] Existing installs: apply BUNDLES[0] exactly once on the next run.
        const seeded = await Storage.get('bundles_default_seeded');
        if (!seeded) {
            try {
                const b0 = (BUNDLES || []).find(b => b.id === 'bundle-default');
                if (b0) await new Bundles().applyBundle(b0); // idempotent: id-collision skip
            } catch (e) { log('e', 'BUNDLE_DEFAULT_SEED_FAILED', e.message); }
            await Storage.set({ bundles_default_seeded: true });
            log('LOGIC', 'BUNDLE_DEFAULT_SEEDED', {});
        }
    }

    // [V13.S³] Identity Anchor State Hydration
    const storedProfileIntelligence = await Storage.get('profile_intelligence');
    if (storedProfileIntelligence) {
        State.set('profile_intelligence', storedProfileIntelligence);
        log('DATA', 'STATE_HYDRATED', { key: 'profile_intelligence', length: JSON.stringify(storedProfileIntelligence).length });
    }

    // S3-State-Persistence: Global Hydration
    const rawStorage = await Storage.get_raw_all();
        
    // Filter for valid global persisted state keys (add others as needed)
    const stateUpdate = {};
    const persistentKeys = [
        'void_source_auditor', 
        'cognitive_origin_auditor', 
        'engagement_kinetics',
        'social_alchemy',
        'thematic_tagging',        
        'emoji_enhancement',
        'kaomoji_enhancement',
        'boldify_enhancement',
        'image_prompt_addon',
        'detailed_suggestions',
        'api_key',
        'selected_model_id',
        // [CWS] consent + granted-origins MUST rehydrate, or the consent modal
        // re-fires every boot (set() persists them via _configKeys, but nothing read them back).
        'text_analysis_consent',
        'granted_origins'        
    ];
        
    persistentKeys.forEach(key => {
        if (rawStorage.hasOwnProperty(key)) {
            stateUpdate[key] = rawStorage[key];
        }
    });
        
    State.update(stateUpdate);
    window.dispatchEvent(new CustomEvent('STATE_RESTORED'));

    log('LOGIC', 'INIT', Language.text('MSG_APP_INITIALIZED'));
    setTimeout(() => Logger.userLog('LOG_APP_READY', 'success'), 150);
        
    const root = document.getElementById('app-root');
    if (root) {
        root.classList.add('alchimist-root');
        const topPaneContainer = document.createElement('header');
        topPaneContainer.id = 'top-pane-container';
        topPaneContainer.className = 'flex-none';
        
        const mainContentArea = document.createElement('div');
        mainContentArea.id = 'main-content';
        mainContentArea.className = 'flex-1 overflow-hidden min-h-0 relative flex flex-col';
        
        root.innerHTML = '';
        root.appendChild(topPaneContainer);
        root.appendChild(mainContentArea);

        const topPane = new TopPane(topPaneContainer);
        topPane.render();

        const mainContent = new MainContentArea(mainContentArea);
        mainContent.render();

        const footer = new Footer(root);
        footer.render();

        window.addEventListener('alchimist:render-complete', () => {
            if (State.get('is_transmuting')) {
                State.set('is_transmuting', false);
                log('LOGIC', 'WAITING_RELEASED', 'View handshake complete.');
            }
        });

        window.app = window.app || {};
        window.app.waiting = new Waiting();
        window.app.errorCover = new ErrorCover();
        window.app.premiumCover = new PremiumCover();

        window.TargetingInstance = new Targeting();

        // [V20] Clip-aware visibility test. offsetParent ignores ancestor clipping: a
        // collapsed Expander sets max-height:0 / overflow:hidden on its body (never
        // display:none), so descendants keep a non-null offsetParent while invisible.
        // Reject any element sitting inside an .expandable-body that is clipped to 0px.
        const isVisiblyRendered = (el) => {
            if (!el || !el.isConnected || el.offsetParent === null) return false;
            let host = el.closest('.expandable-body');
            while (host) {
                if (host.getBoundingClientRect().height === 0) return false;
                host = host.parentElement && host.parentElement.closest('.expandable-body');
            }
            return true;
        };

        // [V13.FIX] Logic-First Gateway Suppression Manifold
        // Reconciles tab state and logical modes (Alchemy/Manage) for absolute visibility hygiene.
        const evaluateDomReality = () => {
            const gateway = document.querySelector('.action-gateway');
            if (!gateway) return;

            // [V20] Anchor alchemy-mode on the genuine on-screen rendering of the alchemy
            // tab controls (.alchemy-tab-btn inside #alchemy-root). Collapsing the Metrics
            // expander clips them to zero height; switching to the Inventory sub-tab tears
            // #alchemy-root down entirely. Both now correctly read as NOT visible, so
            // is-mode-alchemy (and the .action-gateway suppression CSS) is released.
            const alchemyTabBtn = document.querySelector('#alchemy-root .alchemy-tab-btn');
            const isAlchemyVisible = isVisiblyRendered(alchemyTabBtn);

            const isManaging = State.get('is_managing_personas');
            
            // Logic: Determine if the Forge container is physically on screen
            const forgeContainer = document.getElementById('forge-container');
            const isForgeActive = forgeContainer && forgeContainer.offsetParent !== null;

            // RULE: The Gateway ONLY shows if we are in Forge AND NOT in a sub-mode (Alchemy or Manage)
            const shouldShow = isForgeActive && !isAlchemyVisible && !isManaging;

            // Global alchemy state toggle for CSS scoping
            if (isAlchemyVisible) {
                document.body.classList.add('is-mode-alchemy');
            } else {
                document.body.classList.remove('is-mode-alchemy');
            }


        };

        const alchemyObserver = new MutationObserver(evaluateDomReality);
        const observerTarget = document.getElementById('app-root') || document.body;
        
        alchemyObserver.observe(observerTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        
        // Subscribe to manage state changes for real-time reactivity
        window.addEventListener('MANAGE_PERSONAS_STATE', evaluateDomReality);

        // [V20] Re-evaluate the instant a metric-management sub-tab is clicked. Clicking
        // 'Inventory' synchronously tears down #alchemy-root, so is-mode-alchemy must clear
        // immediately rather than waiting on the next MutationObserver tick.
        document.addEventListener('click', (e) => {
            if (e.target && e.target.closest && e.target.closest('.alchemy-tab-btn')) {
                requestAnimationFrame(evaluateDomReality);
            }
        });

        evaluateDomReality();

        // [V13.FIX] Editor Dismissal Intent Handoff
        window.addEventListener('EDITOR_DISMISSED', (e) => {
            setTimeout(() => {
                evaluateDomReality();
                window.dispatchEvent(new CustomEvent('INTENT_CHANGED', { detail: { forceReeval: true } }));
            }, 10);
        }, true);

        // [V13.FIX] Multi-Tab State Reconciliation (Tab Switch Sync)
        window.addEventListener('TAB_SWITCH', (e) => {
            const target = e.detail?.target || e.detail?.id || e.detail;
            if (!target) return;

            const isManaging = State.get('is_managing_personas');
            
            // Logic: Manage mode visuals are strictly isolated to the Forge tab.
            const visualManaging = (target === 'Forge' && isManaging);
            
            const reconcile = () => {
                // [V13.FIX] Context Invalidation: Kill the "Tail" on tab switch
                State.resetVolatile();
                log('DATA', 'CONTEXT_WIPE', { reason: 'TAB_SWITCH', target });

                // Force components (like Footer) to reconcile their text and layout
                window.dispatchEvent(new CustomEvent('ASPECT_CHANGE', { 
                    detail: { id: visualManaging ? 'ManagePersonas' : 'InfluenceCore' } 
                }));
                window.dispatchEvent(new CustomEvent('MANAGE_PERSONAS_STATE', { 
                    detail: { isManaging: visualManaging, isEditing: false } 
                }));
                
                evaluateDomReality();
            };

            reconcile();
        }, true);
    }
}

// Boot when DOM is settled
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initiate();
        // [CWS] Gate consent on hydration: has('text_analysis') reads the volatile
        // default (false) until STATE_RESTORED lands, so the prompt must wait for it.
        // The warning (consent) MUST surface BEFORE the tutorial. Consent.init() can only
        // run after STATE_RESTORED, so the tutorial is deferred into the same handler and
        // fired AFTER the consent render (consent z-index 100000 sits above tutorial z-9999).
        window.addEventListener('STATE_RESTORED', () => {
            Consent.init();
            WelcomeScreen.init();
        }, { once: true });
    });
} else {
    initiate();
    // [CWS] Gate consent on hydration: has('text_analysis') reads the volatile
    // default (false) until STATE_RESTORED lands, so the prompt must wait for it.
    // (Side panels boot with readyState !== 'loading', so THIS branch is the live path.)
    // The warning (consent) MUST surface BEFORE the tutorial. Consent.init() can only
    // run after STATE_RESTORED, so the tutorial is deferred into the same handler and
    // fired AFTER the consent render (consent z-index 100000 sits above tutorial z-9999).
    window.addEventListener('STATE_RESTORED', () => {
        Consent.init();
        WelcomeScreen.init();
    }, { once: true });
}