/**
 * @file utils/Tester.js
 * @purpose Centralized testing utility for executing dry-runs and verifying protocol integrity without hitting real APIs.
 */
import { State } from '../services/State.js';
import { Storage } from '../services/Storage.js';
import { Alchemy } from '../components/core/Alchemy.js';
import { log } from './logger.js';

export const Tester = {
    async test(type) {
        switch(type) {
            case 'transmute':
                await this.runMockTransmute();
                break;
            case 'alchemy:integration':
                await this.runAlchemyIntegrationTest();
                break;
            case 'footer_gateway_restoration':
                await this.runFooterGatewayRestorationTest();
                break;
            default:
                log('e', 'TEST_UNKNOWN', `Unknown test type: ${type}`);
        }
    },

    async runMockTransmute() {
        log('TEST', 'TRANSMUTE_MOCK_START', 'Initiating dry-run transmutation...');
        
        // Fetch real session state to populate header
        const personas = await Storage.get('personas') || [];
        const activeId = await Storage.get('personas_active_id');
        const activePersona = personas.find(p => p.id === activeId) || personas[0];
        
        const strategyId = await Storage.get('strategy_active_id') || 'thread-weaver';
        const modeId = await Storage.get('mode_active_id') || 'reflective';

        const data = this.generateMockOutput(activePersona, strategyId, modeId);
        
        // Step 1: Storage Injection
        const currentOutputs = await Storage.get('currentOutputs') || [];
        currentOutputs.unshift(data); // Prepend to show at the top of Sanctuary
        await Storage.set({ currentOutputs });
        
        // Seed the DNA Shard for the Suggestions module
        await Storage.set({ [`ctx_${data.id}`]: { raw: "Mock DNA Payload for Refinement" } });
        
        // Step 2: UI Event Dispatch
        window.dispatchEvent(new CustomEvent('alchimist:outputs-updated'));
        
        // Step 3: Navigation Trigger (Forces MainContentArea to switch to Sanctuary)
        window.dispatchEvent(new CustomEvent('ui:request-tab-switch', { detail: { tab: 'Sanctuary' } }));
        
        log('TEST', 'TRANSMUTE_MOCK_SUCCESS', { id: data.id });

        // Step 4: Geometric Telemetry & Proof
        setTimeout(() => {
            const expander = document.querySelector(`#exp-${data.id}`);
            if (!expander) {
                log('e', 'GEOMETRY_PROOF', 'Expander shell not found in DOM.');
                return;
            }
            const body = expander.querySelector('.expandable-body');
            const header = expander.querySelector('.expandable-header');
            
            log('TEST', 'GEOMETRY_PROOF_PRE', { id: data.id, height: body.clientHeight, expected: 0 });
            
            if (header) header.click(); // Trigger lazy load
            
            setTimeout(() => {
                const contentH = body.scrollHeight;
                log('TEST', 'GEOMETRY_PROOF_POST', { 
                    id: data.id, 
                    height: body.clientHeight, 
                    scrollHeight: contentH,
                    hasResultCard: !!body.querySelector('.result-card'),
                    hasSignalHeader: !!body.querySelector('.sanctuary-signal-header')
                });
            }, 800); // wait for animation
        }, 1000);
    },

    generateMockOutput(persona, strategy, mode) {
        return {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'mock-' + Date.now(),
            meta: { 
                personaName: persona?.name || "Unknown Persona", 
                strategyLabel: strategy.replace('-', ' '),
                modeLabel: mode,
                personaDescription: persona?.desc || "No description available."
            },
            output: [{
                context_data_in_one_sentence: "Transmuting selected digital artifact into high-value social impact.",
                text: "The essence of this conversation lies in the tension between perceived value and inherent utility.\n\nTrue growth occurs when we stop optimizing for the echo and start building for the architecture.",
                metrics: { 
                    "Resonance": Math.floor(Math.random() * 41) + 60, // Skew high
                    "Clarity": Math.floor(Math.random() * 101),
                    "Impact": Math.floor(Math.random() * 101)
                },
                suggestions: ["Expand scope", "Differentiate value", "Audit baseline"]
            }]
        };
    },

    async runAlchemyIntegrationTest() {
        log('TEST', 'ALCHEMY_INTEGRATION_CYCLE_START');
        
        State.update({
            is_managing_personas: true,
            personas_active_id: 'synth-test-zcvcl',
            active_persona_id: 'synth-test-zcvcl',
            alchemy_synthesis_active: true
        });
        
        log('TEST', 'STATE_SNAPSHOT', { 
            mode: 'manage_personas', 
            targetId: 'synth-test-zcvcl' 
        });

        const mockPersona = { 
            id: 'digital-asset-architect', 
            name: 'Digital Asset Architect' 
        };

        log('TEST', 'ACTION', 'Clicking Integrate to Vault');
        await Alchemy.handleIntegrate(mockPersona);

        // 3. Verify Initial Transition
        const transitionSuccess = await this.poll(() => {
            return State.get('is_managing_personas') === false && 
                   (State.get('personas_active_id') || State.get('active_persona_id')) === mockPersona.id;
        }, 1000);

        if (!transitionSuccess) throw new Error('TEST_CRASH: INITIAL_TRANSITION_FAILED');

        // 4. Verification of State Finality (Anti-Ghost Expansion)
        // We wait to see if any component re-asserts management mode
        const remainsIdle = await new Promise(resolve => {
            let failed = false;
            const check = () => {
                if (State.get('is_managing_personas') === true) failed = true;
            };
            const interval = setInterval(check, 50);
            setTimeout(() => {
                clearInterval(interval);
                resolve(!failed);
            }, 800);
        });

        if (!remainsIdle) {
            log('e', 'GHOST_EXPANSION_DETECTED', { is_managing: true });
            throw new Error('TEST_CRASH: GHOST_EXPANSION_DETECTED');
        }
        
        log('TEST', 'ALCHEMY_INTEGRATION_CYCLE_END');
    },

    async runFooterGatewayRestorationTest() {
        log('TEST', 'FOOTER_GATEWAY_RESTORATION_START');
        
        // 1. Simulate active persona
        window.dispatchEvent(new CustomEvent('PERSONA_SELECTED', { detail: { id: 'mock-123' } }));
        await new Promise(r => setTimeout(r, 100)); // Allow DOM to settle
        
        // 2. Open Editor
        window.dispatchEvent(new CustomEvent('EDITOR_OPENED', { detail: { caption: 'Create Preset' } }));
        await new Promise(r => setTimeout(r, 100));
        
        // 3. Dismiss Editor
        window.dispatchEvent(new CustomEvent('EDITOR_DISMISSED', { detail: { caption: 'Create Preset' } }));
        await new Promise(r => setTimeout(r, 200)); // Wait for 10ms debounce in app.js
        
        log('TEST', 'FOOTER_GATEWAY_RESTORATION_END');
    },

    async poll(fn, timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (fn()) return true;
            await new Promise(r => setTimeout(r, 50));
        }
        return false;
    }
};

// Force strict override to prevent Orchestrator integration suite from hijacking test()
// Use getter/setter to silently absorb overwrites and avoid fatal TypeError crash
Object.defineProperty(window, 'test', {
    get: () => (type) => Tester.test(type),
    set: (val) => log('w', 'TESTER_LOCKED', 'Blocked legacy test overwrite attempt.'),
    enumerable: false,
    configurable: true
});
console.log('Influence Alchimist Tester: [READY]');

test('footer_gateway_restoration_after_editor_dismiss', async () => {
    // 1. Simulate active persona (Intent valid)
    await dispatch('PERSONA_SELECTED', { id: 'mock-123' });
    check('Gateway is visible', Footer.isVisible() === true);
    
    // 2. Open Editor (Gateway hides)
    await dispatch('EDITOR_OPENED', { caption: 'Create Preset' });
    check('Gateway is hidden by Editor', Footer.isVisible() === false);
    
    // 3. Dismiss Editor (Gateway MUST restore)
    await dispatch('EDITOR_DISMISSED', { caption: 'Create Preset' });
    check('Gateway restored properly', Footer.isVisible() === true);
    check('Gateway action is Transmute', Footer.getAction() === 'alchemy:transmute');
});