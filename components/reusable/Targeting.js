/**
 * @file components/Targeting.js
 * @purpose TARGETING: Component handling guided UI scenarios (e.g., missing API keys).
 * @standard BEM, Class-based components, Axiomatic DOM.
 */

import { dom } from '../../utils/dom.js';
import { l } from '../../utils/logger.js';
import { Language } from '../../services/Language.js';

export class Targeting {
    constructor() {
        this.dimmer = null;
        this.hint = null;
        this.activeTarget = null;
        this.isScenarioRunning = false;
        
        l('i', '[TARGETING][INIT]', 'Targeting Instance constructed.');
        
        // Exposed for manual console debugging
        window.debug_targeting = (id = 'GEMINI_API_KEY_MISSING') => {
            l('i', '[TARGETING][DEBUG]', `Manual trigger for scenario: ${id}`);
            this.run(id);
        };
    }

    /**
     * Entry point for targeting scenarios.
     * @param {string} scenarioId 
     */
    async run(scenarioId) {
        if (this.isScenarioRunning) {
            l('w', '[TARGETING][TRACE]', `Scenario already running: ${scenarioId}`);
            return;
        }
        
        l('i', '[LOGIC][TARGETING]', `Invoking scenario component: ${scenarioId}`);

        // Force hide all possible blockers
        if (window.app?.waiting) window.app.waiting.hide();
        if (window.app?.errorCover) window.app.errorCover.hide();
        
        document.querySelectorAll('.waiting-overlay, .error-cover').forEach(el => el.classList.add('u-hidden'));

        this.isScenarioRunning = true;

        try {
            switch (scenarioId) {
                case 'GEMINI_API_KEY_MISSING':
                    await this.#handleMissingApiKey();
                    break;
                default:
                    l('w', '[LOGIC][TARGETING]', `Unknown scenario: ${scenarioId}`);
                    this.isScenarioRunning = false;
            }
        } catch (error) {
            l('e', '[LOGIC][TARGETING]', `Scenario ${scenarioId} crashed`, error);
            this.isScenarioRunning = false;
        }
    }

    /**
     * Guided flow for missing credentials.
     */
    async #handleMissingApiKey() {
        const selector = '.api-slot__key-input';
        l('i', '[TARGETING][TRACE]', `Starting target search for: ${selector}`);
        
        let input = document.querySelector(selector);

        if (!input) {
            l('i', '[TARGETING][TRACE]', 'Target not found instantly. Triggering navigation & High-Speed DOM Polling...');
            const settingsTab = document.querySelector('button[title*="Config"], .tab-btn[data-tab="Config"]');
            if (settingsTab) {
                settingsTab.click();
            } else {
                l('w', '[TARGETING][TRACE]', 'Settings tab button NOT found in DOM.');
            }

            input = await new Promise(resolve => {
                const endTime = Date.now() + 3000;
                const check = () => {
                    const el = document.querySelector(selector);
                    if (el) {
                        l('i', '[TARGETING][TRACE]', 'Target found via polling loop.');
                        return resolve(el);
                    }
                    if (Date.now() > endTime) {
                        l('w', '[TARGETING][TRACE]', 'Polling loop timed out.');
                        return resolve(null);
                    }
                    requestAnimationFrame(check);
                };
                check();
            });
        }

        if (!input) {
            l('e', '[UI][TARGETING]', `Failed to find target field: ${selector}`);
            this.isScenarioRunning = false;
            return;
        }

        // Strict Fallback Validation
        let hintText = Language.text('HINT_API_KEY_REQUIRED');
        if (!hintText || hintText === 'HINT_API_KEY_REQUIRED') {
            hintText = "Please enter your Gemini API key here to enable AI features. You can find it in Google AI Studio -> Get API Key -> Create New Key";
        }
        
        this.emphasize(input, hintText);
    }

    /**
     * Visual emphasis: Dim background, highlight element, show hint.
     */
    emphasize(element, message) {
        l('i', '[TARGETING][TRACE]', 'Entering emphasize() phase.');
        
        // Reset visuals only, maintaining scenario state
        this.clear(false); 

        this.activeTarget = element;

        // Sovereign Inline Styling
        this.dimmer = dom.create('div', 'targeting-dimmer', {
            style: 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.75); z-index: 90; pointer-events: auto; transition: opacity 0.3s;'
        });
        
        this.hint = dom.create('div', 'targeting-hint', {
            textContent: message,
            style: 'position: absolute; top: 100%; left: 0; margin-top: 0.25rem; padding: 0.35rem; background-color: #d4af37; color: #0a0a0a; font-weight: bold; font-size: 0.875rem; border-radius: 0.5rem; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); z-index: 101; white-space: normal; max-width: min(360px, calc(100vw - 2rem)); word-break: break-word;'
        });

        element.classList.add('u-emphasized-focus');
        
        const parent = element.closest('.api-slot') || element.closest('.input-group') || element.parentElement;
        if (parent) {
            l('i', '[TARGETING][TRACE]', 'Parent container resolved for elevation.', { className: parent.className });
            parent.classList.add('u-lift'); 
            parent.style.setProperty('position', 'relative', 'important');
            parent.style.setProperty('z-index', '100', 'important');
            parent.appendChild(this.hint);
        }

        document.body.appendChild(this.dimmer);
        
        try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch(e) {}
        
        // Focus Command
        const performFocus = () => {
            if (!this.isScenarioRunning) {
                l('w', '[TARGETING][TRACE]', 'Focus aborted: Scenario no longer running.');
                return;
            }
            
            // Re-verify element is still in DOM (safety for rapid re-renders)
            if (!document.contains(element)) {
                l('w', '[TARGETING][TRACE]', 'Focus aborted: Element detached from DOM.');
                return;
            }

            l('i', '[TARGETING][TRACE]', 'Executing focus command.');
            element.focus({ preventScroll: true });
            if (document.activeElement !== element) {
                l('i', '[TARGETING][TRACE]', 'Focus rejected, attempting click-to-focus.');
                element.click();
                element.focus({ preventScroll: true });
            }
        };

        setTimeout(performFocus, 150);

        let isCleanupReady = false;
        setTimeout(() => { isCleanupReady = true; }, 500);

        // FOCUS RECOVERY: If focus is lost due to re-renders or stealing, snatch it back
        const focusSnatchback = (e) => {
            if (this.isScenarioRunning && isCleanupReady) {
                l('w', '[TARGETING][TRACE]', 'Focus lost. Re-asserting sovereignty...');
                setTimeout(performFocus, 50);
            }
        };

        // Cleanup ONLY on input (user typing) or clicking the background
        const cleanup = (e) => {
            if (!isCleanupReady) return;
            l('i', '[TARGETING][TRACE]', `Cleanup triggered by: ${e?.type || 'manual'}`);
            this.clear(true);
            element.removeEventListener('input', cleanup);
            
            element.removeEventListener('blur', focusSnatchback);
            delete element.dataset.isTargeted;
        };

        if (!element.dataset.isTargeted) {
            element.dataset.isTargeted = 'true';
            element.addEventListener('input', cleanup);
            
            element.addEventListener('blur', focusSnatchback);
        }
        this.dimmer.onclick = cleanup;
    }

    /**
     * Remove all targeting UI elements and restore surroundings.
     * @param {boolean} stopScenario - Whether to also set isScenarioRunning to false.
     */
    clear(stopScenario = false) {
        if (this.dimmer) {
            this.dimmer.remove();
            this.dimmer = null;
        }
        if (this.hint) {
            this.hint.remove();
            this.hint = null;
        }
        if (this.activeTarget) {
            this.activeTarget.classList.remove('u-emphasized-focus');
            const parent = this.activeTarget.closest('.api-slot') || this.activeTarget.closest('.input-group') || this.activeTarget.parentElement;
            if (parent) {
                parent.classList.remove('u-lift');
                parent.style.removeProperty('z-index');
                parent.style.removeProperty('position');
            }
            this.activeTarget = null;
        }
        
        if (stopScenario) {
            this.isScenarioRunning = false;
        }
    }
}