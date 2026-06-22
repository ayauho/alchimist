/**
 * @file services/AlchemyService.js
 * @purpose Atomic logic for Persona Alchemy operations.
 */
import { PromptCompiler } from './PromptCompiler.js';
import { log, Logger } from '../utils/logger.js';
import { LLM } from './LLM.js';
import { State } from './State.js';
import { Storage } from './Storage.js';
import { Scraper } from '../modules/Scraper.js';
import { PromptTemplates } from '../utils/promptTemplates.js';
import { IntelligenceService } from './PersonaLearningService.js';
// [V14] Voice profiles for Metric Alchemy paths. Forwarded to PromptCompiler as the persona
// block; PERSONA_PROFILE template (extended in Phase 4) reads opts.name/opts.prompt and
// emits "Voice Profile: Metric *" without colliding with the Persona crossbreed branch.
import {
    ALCHEMIST_VOICE_METRIC_SYNTH,
    ALCHEMIST_VOICE_METRIC_MUTATE,
    ALCHEMIST_VOICE_METRIC_CROSS
} from '../utils/constants.js';

export const AlchemyService = {
    /**
     * Executes atomic synthesis.
     * Derived from legacy prompts.js logic via PromptCompiler.
     */
    async executeSynthesis(topology) {
        log('AI', 'ALCHEMY_SYNTH_START', { source: topology.selected_text ? 'selection' : 'page' });
        Logger.userLog('LOG_INIT_SYNTHESIS', 'initiated');
        State.set('is_synthesizing', true);

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

        const prompt = PromptCompiler.compile({
            persona: { id: 'alchemist', name: 'Persona Synthesizer', prompt: 'Synthesize Persona from text. "emoji" should be populated with 1 emoji. Do not add "AI" to Persona name. First tag is the most general and considered as category.' },
            tags: ['CORE_MANDATE', 'STRATEGIC_OBJECTIVE', 'PERSONA_PROFILE', 'COGNITIVE_MEMBRANE', 'CONTEXT_DATA', 'SOVEREIGN_IDENTITY_SCHEMA'],
            context,
            config: { 
                type: 'synthesis',
                interactionType: 'synthesis',
                sigil: 'ALCHEMY-BETA',
                mode: 'single'
            }
        });

        try {
            const raw = await LLM.transmute(prompt.raw);
            
            // Unified Unboxing: Parse string if it's JSON, then extract the first object
            let data = raw;
            if (typeof raw === 'string') {
                data = IntelligenceService.extractJson(raw);
            }
            const persona = Array.isArray(data) ? data[0] : data;
            
            log('DATA', 'ALCHEMY_RESULT', persona);
            Logger.userLog('LOG_SUC_SYNTHESIS', 'success');
            return persona;
        } catch (error) {
            log('e', 'ALCHEMY_SYNTH_FAIL', error);
            Logger.userLog('LOG_ERR_SYNTHESIS', 'error');
            throw error;
        } finally {
            State.set('is_synthesizing', false);
        }
    },

    /**
     * Integrates a synthesized persona into the repository and orchestrates UI navigation.
     * Closes repository mode, selects the new persona, and signals the UI to align/scroll to it.
     */
    async integrate(persona) {
        log('DATA', 'ALCHEMY_INTEGRATE_START', persona.id);

        // [V13.S³] Identity Atomicity: Final defensive clone before Substrate commitment
        if (persona.persona_knowledge) {
            persona.persona_knowledge = JSON.parse(JSON.stringify(persona.persona_knowledge));
        }

        // 1. Persistence to State (Atomic Storage Guard)
        const personas = await Storage.get('personas') || [];
        if (!personas.find(p => p.id === persona.id)) {
            // Add to start of list so it's immediately visible in the selector
            personas.unshift(persona);
            State.set('personas', personas);
            await Storage.set({ personas: personas });
        }

        // 2. Navigation State Change
        // Exit "Manage Personas" mode (repository view) to return to the active list
        State.set('is_managing_personas', false);
        
        log('DATA', 'ALCHEMY_INTEGRATE_COMPLETE', persona.id);
            
        // Signal the UI and sorting tools to refresh their lists
        window.dispatchEvent(new CustomEvent('ALCHEMY_INTEGRATION_SUCCESS', { detail: persona }));
    },

    /**
     * Mutate an existing persona based on current context.
     * @param {Object} persona - The source persona to mutate.
      * @param {Object} [options]
      * @param {Boolean} [options.inheritKnowledge] - When true, instruct the AI (via the Inherit
      *   protocol) to forge the new persona's seed knowledge by evolving the source persona's
      *   knowledge into "add" commands, then materialize those via PersonaLearningService and
      *   attach the result to the returned persona. When false (default), the new persona starts
      *   with no inherited knowledge — the previous unconditional verbatim clone is removed.
     */
     async mutate(persona, options = {}) {
        if (!persona) throw new Error("No persona selected for mutation.");
         const inheritKnowledge = options.inheritKnowledge === true;

         log('ALCHEMY', 'MUTATE_START', { id: persona.id, inheritKnowledge }, ['#mutate', '#evolution']);

        // 1. Gather Context (Alignment with Synthesis/Transmutation)
        const contextData = await Scraper.extract();

        // [V13] UI Orchestration: Trigger Mutating Overlay
        State.set('is_mutating', true);

        // 2. Build High-Density Multi-Part Prompt (Parity with Synthesis)
        const prompt = PromptCompiler.compile({
            persona: { 
                id: 'alchemist', 
                name: 'Identity Mutator', 
                prompt: 'Perform high-dimensional mutation of the SOURCE_IDENTITY. Increase metrics: Logic, Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.' 
            },
            tags: ['CORE_MANDATE', 'STRATEGIC_OBJECTIVE', 'PERSONA_PROFILE', 'COGNITIVE_MEMBRANE', 'CONTEXT_DATA', 'SOVEREIGN_IDENTITY_SCHEMA'],
            context: {
                selected_text: contextData.selected_text || '',
                ctrl_a_text: contextData.ctrl_a_text || '',
                context_structure: contextData.context_structure || ''
            },
            config: { 
                interactionType: 'mutation', 
                sigil: 'MUTATE_EVOLUTION',
                mode: 'single',
                // Mutation Specific Data
                sourcePersona: persona,
                 inheritKnowledge,
                metrics: { 
                    "Logic": 80, "Integrity":80, "Craft": 80, "Entropy": 80, "Power": 80, "Resonance": 80, "Harmony": 80, "Holism": 80 
                }
            }
        });

        log('AI', 'PROMPT_SYNTHESIZED', { prompt_length: prompt.raw.length }, ['#prompt-injection']);

        try {
            const raw = await LLM.transmute(prompt.raw);
           
            // Unified Unboxing
            let data = raw;
            if (typeof raw === 'string') {
                data = IntelligenceService.extractJson(raw);
            }
            let mutated = Array.isArray(data) ? data[0] : data;
           
            // [V13.S³] Unwrap if LLM shifted schema to satisfy reasoning constraints
            if (mutated && !mutated.id) {
                if (Array.isArray(mutated.personas) && mutated.personas.length > 0) mutated = mutated.personas[0];
                else if (mutated.persona) mutated = mutated.persona;
            }
           
            if (!mutated) throw new Error("Alchemical mutation failed to produce a valid identity substrate.");

             // [V13] Knowledge Inheritance (opt-in). When the user checked "Inherit Persona Knowledge",
             // the prompt carried PERSONA_KNOWLEDGE_INHERIT_PROTOCOL instructing the AI to emit
             // "add" commands derived (and evolved) from the source persona's knowledge. We
             // materialize those commands via PersonaLearningService in returnOnly mode so nothing
             // touches persisted personas — the resulting array becomes the new persona's seed.
             // When the flag is off, the new persona intentionally starts with no inherited knowledge.
             if (inheritKnowledge && Array.isArray(mutated.update_persona_knowledge)) {
                 const inheritResult = await IntelligenceService.processLearningUpdates(mutated, 'alchemy_mutate', {
                     startingKnowledge: [],
                     returnOnly: true
                 });
                 mutated.persona_knowledge = (inheritResult && inheritResult.knowledge) || [];
                 delete mutated.update_persona_knowledge;
                 log('DATA', 'ALCHEMY_MUTATE_INHERIT_APPLIED', {
                     sourceId: persona.id,
                     seeded: mutated.persona_knowledge.length
                 });
             }
           
            log('DATA', 'ALCHEMY_RESULT', mutated);
            Logger.userLog('LOG_SUC_MUTATE', 'success');

            return mutated;
        } catch (err) {
            log('ALCHEMY', 'MUTATE_ERROR', err.message, ['#fail']);
            Logger.userLog('LOG_ERR_MUTATE', 'error');
            throw err;
        } finally {
            // [V13] UI Orchestration: Release Mutating Overlay
            State.set('is_mutating', false);
        }
    },

    /**
     * Executes Crossbreed transmutation.
     * @param {Object} persona1 - First parent persona.
     * @param {Object} persona2 - Second parent persona.
     * @param {Boolean} isDryRun - If true, logs the generated prompt and aborts AI call.
      * @param {Object} [options]
      * @param {Boolean} [options.inheritKnowledge] - When true, the AI is instructed (via the Inherit
      *   protocol) to inherit, evolve, and crossbreed both source personas' knowledges into "add"
      *   commands; results are materialized through PersonaLearningService and attached to the
      *   returned persona. When false (default), the new persona starts with no inherited knowledge.
     */
     async crossbreed(persona1, persona2, isDryRun = false, options = {}) {
         const inheritKnowledge = options.inheritKnowledge === true;
         log('AI', 'ALCHEMY_CROSSBREED_START', { p1: persona1.id, p2: persona2.id, isDryRun, inheritKnowledge });
       
        // [V13] UI Orchestration: Trigger Crossbreeding Overlay
        State.set('is_crossbreeding', true);

        // Substrate context gathering is aggressively bypassed here 
        // to strictly adhere to [MUST_CONTAIN_NO_<CONTEXT_DATA>] and speed up execution.

        const prompt = PromptCompiler.compile({
            persona: { id: 'alchemist', name: 'Persona Alchemist' },
            tags: ['CORE_MANDATE', 'STRATEGIC_OBJECTIVE', 'PERSONA_PROFILE', 'SOVEREIGN_IDENTITY_SCHEMA'],
            config: { 
                interactionType: 'crossbreed', 
                sigil: 'CROSSBREED_EVOLUTION',
                mode: 'dual',
                sourcePersona1: persona1,
                sourcePersona2: persona2,
                 inheritKnowledge,
                metrics: { 
                    "Logic Integrity": 80, "Craft": 80, "Entropy": 80, "Power": 80, "Resonance": 80, "Harmony": 80, "Holism": 80 
                }
            }
        });

        log('AI', 'PROMPT_SYNTHESIZED', { prompt_length: prompt.raw.length }, ['#prompt-injection']);
        
        if (isDryRun) {
            log('TEST', 'CROSSBREED_DRY_RUN_STOP', { prompt: prompt.raw });
            State.set('is_crossbreeding', false);
            return prompt;
        }

        try {
            const raw = await LLM.transmute(prompt.raw);
            
            let data = raw;
            if (typeof raw === 'string') {
                data = IntelligenceService.extractJson(raw);
            }
            let crossbred = Array.isArray(data) ? data[0] : data;
            
            const mandatory = ['id', 'name', 'desc', 'prompt', 'tags', 'emoji'];
            const missing = mandatory.filter(k => !crossbred || !crossbred[k]);

            if (missing.length > 0) {
                log('DATA', 'SCHEMA_VALIDATION_FAIL', { missing, received: crossbred });
                throw new Error(`Alchemical result non-compliant. Missing mandatory fields: ${missing.join(', ')}`);
            }

             // [V13] Knowledge Inheritance (opt-in) — mirrors the mutate() flow but with both
             // parents' knowledges available to the AI as PERSONA_KNOWLEDGE. The "add"-only
             // inherit protocol instructs the AI to crossbreed and evolve those into the new
             // persona's seed. When the flag is off, no inheritance occurs — the previous
             // unconditional concat-clone of (k1 + k2) is intentionally removed.
             if (inheritKnowledge && Array.isArray(crossbred.update_persona_knowledge)) {
                 const inheritResult = await IntelligenceService.processLearningUpdates(crossbred, 'alchemy_crossbreed', {
                     startingKnowledge: [],
                     returnOnly: true
                 });
                 crossbred.persona_knowledge = (inheritResult && inheritResult.knowledge) || [];
                 delete crossbred.update_persona_knowledge;
                 log('DATA', 'ALCHEMY_CROSSBREED_INHERIT_APPLIED', {
                     p1: persona1.id, p2: persona2.id,
                     seeded: crossbred.persona_knowledge.length
                 });
             }

            log('DATA', 'ALCHEMY_RESULT', crossbred);
            Logger.userLog('LOG_SUC_CROSSBREED', 'success');
            return crossbred;
        } catch (err) {
            log('ALCHEMY', 'CROSSBREED_FAIL', err.message);
            Logger.userLog('LOG_ERR_CROSSBREED', 'error');
            throw err;
        } finally {
            State.set('is_crossbreeding', false);
        }
    },

    // =====================================================================
    // [V14] METRIC ALCHEMY — user-defined metrics evolution
    // ---------------------------------------------------------------------
    // Audit §8.8 pivot: metric integration emits a DEDICATED event channel
    // 'ALCHEMY_METRIC_INTEGRATION_SUCCESS' (option b) instead of kind-tagging
    // the existing 'ALCHEMY_INTEGRATION_SUCCESS' (option a). This keeps the
    // Persona.alchemyIntegrationHandler completely untouched — it accesses
    // e.detail as a raw persona object, so spread-wrapping would risk passing
    // a `kind`-field-polluted record into savePersona.
    // =====================================================================

    /**
     * Synthesize a new user-defined Metric from the current page context.
     * Mirrors executeSynthesis but emits the metric_synthesis interactionType,
     * which routes PromptTemplates.SOVEREIGN_IDENTITY_SCHEMA to the metric
     * blueprint short-circuit (Phase 4) and bypasses persona-only audit/engagement
     * fragments via the extended isAlchemyCreation predicate (Phase 5).
     *
     * @param {Object} topology - {selected_text, ctrl_a_text, context_structure}
     * @returns {Promise<{id, name, desc}>}
     */
    async synthesizeMetric(topology) {
        log('AI', 'METRIC_ALCHEMY_SYNTH_START', { source: topology.selected_text ? 'selection' : 'page' });
        Logger.userLog('LOG_INIT_METRIC_SYNTH', 'initiated');
        State.set('is_synthesizing_metric', true);

        // Substrate Commitment (parity with executeSynthesis line 4750)
        State.set('page_content', topology.ctrl_a_text || '');
        State.set('context_structure', topology.context_structure || '');

        if (!topology.ctrl_a_text || topology.ctrl_a_text.trim().length === 0) {
            State.set('is_synthesizing_metric', false);
            throw new Error("Metric synthesis failed: No page content detected. Ensure the page has loaded or select text.");
        }

        const context = {
            selected_text: topology.selected_text || '',
            ctrl_a_text: topology.ctrl_a_text || '',
            context_structure: topology.context_structure || ''
        };

        const prompt = PromptCompiler.compile({
            persona: { id: 'alchemist', name: ALCHEMIST_VOICE_METRIC_SYNTH.name, prompt: ALCHEMIST_VOICE_METRIC_SYNTH.prompt },
            tags: ['CORE_MANDATE', 'STRATEGIC_OBJECTIVE', 'PERSONA_PROFILE', 'COGNITIVE_MEMBRANE', 'CONTEXT_DATA', 'SOVEREIGN_IDENTITY_SCHEMA'],
            context,
            config: {
                type: 'metric_synthesis',
                interactionType: 'metric_synthesis',
                sigil: 'METRIC-SYNTH',
                mode: 'single'
            }
        });

        log('AI', 'PROMPT_SYNTHESIZED', { prompt_length: prompt.raw.length, kind: 'metric_synthesis' }, ['#prompt-injection']);

        try {
            const raw = await LLM.transmute(prompt.raw);

            let data = raw;
            if (typeof raw === 'string') {
                data = IntelligenceService.extractJson(raw);
            }
            const metric = Array.isArray(data) ? data[0] : data;

            if (!metric || !metric.name || !metric.desc) {
                throw new Error("Metric synthesis result missing required {name, desc} fields.");
            }
            if (!metric.id) metric.id = `mtr-${Date.now()}`;

            log('AI', 'METRIC_ALCHEMY_SYNTH_SUCCESS', metric);
            Logger.userLog('LOG_SUC_METRIC_SYNTH', 'success');
            return metric;
        } catch (error) {
            log('e', 'METRIC_ALCHEMY_SYNTH_FAIL', error);
            Logger.userLog('LOG_ERR_METRIC_SYNTH', 'error');
            throw error;
        } finally {
            State.set('is_synthesizing_metric', false);
        }
    },

    /**
     * Mutate an existing user-defined Metric using current page context.
     * Note: Metric Alchemy has no concept of "knowledge inheritance" so the
     * inheritKnowledge parameter from Persona.mutate is intentionally absent.
     *
     * @param {Object} metric - The source metric to mutate.
     * @returns {Promise<{id, name, desc}>}
     */
    async mutateMetric(metric) {
        if (!metric) throw new Error("No metric selected for mutation.");
        log('AI', 'METRIC_ALCHEMY_MUTATE_START', { id: metric.id, name: metric.name });
        Logger.userLog('LOG_INIT_METRIC_MUTATE', 'initiated');

        const contextData = await Scraper.extract();
        State.set('is_mutating_metric', true);

        const prompt = PromptCompiler.compile({
            persona: { id: 'alchemist', name: ALCHEMIST_VOICE_METRIC_MUTATE.name, prompt: ALCHEMIST_VOICE_METRIC_MUTATE.prompt },
            tags: ['CORE_MANDATE', 'STRATEGIC_OBJECTIVE', 'PERSONA_PROFILE', 'COGNITIVE_MEMBRANE', 'CONTEXT_DATA', 'SOVEREIGN_IDENTITY_SCHEMA'],
            context: {
                selected_text: contextData.selected_text || '',
                ctrl_a_text: contextData.ctrl_a_text || '',
                context_structure: contextData.context_structure || ''
            },
            config: {
                type: 'metric_mutation',
                interactionType: 'metric_mutation',
                sigil: 'METRIC-MUTATE',
                mode: 'single',
                sourceMetric: metric
            }
        });

        log('AI', 'PROMPT_SYNTHESIZED', { prompt_length: prompt.raw.length, kind: 'metric_mutation' }, ['#prompt-injection']);

        try {
            const raw = await LLM.transmute(prompt.raw);

            let data = raw;
            if (typeof raw === 'string') {
                data = IntelligenceService.extractJson(raw);
            }
            let mutated = Array.isArray(data) ? data[0] : data;

            // Defensive unwrap (parity with mutate's identity-shift guard at line 4892)
            if (mutated && !mutated.id && !mutated.name) {
                if (Array.isArray(mutated.metrics) && mutated.metrics.length > 0) mutated = mutated.metrics[0];
                else if (mutated.metric) mutated = mutated.metric;
            }

            if (!mutated || !mutated.name || !mutated.desc) {
                throw new Error("Metric mutation result missing required {name, desc} fields.");
            }
            if (!mutated.id || mutated.id === metric.id) mutated.id = `mtr-${Date.now()}`;

            log('AI', 'METRIC_ALCHEMY_MUTATE_SUCCESS', mutated);
            Logger.userLog('LOG_SUC_METRIC_MUTATE', 'success');
            return mutated;
        } catch (err) {
            log('e', 'METRIC_ALCHEMY_MUTATE_FAIL', err.message);
            Logger.userLog('LOG_ERR_METRIC_MUTATE', 'error');
            throw err;
        } finally {
            State.set('is_mutating_metric', false);
        }
    },

    /**
     * Crossbreed two user-defined Metrics into one evolved Metric.
     * Skips Scraper extraction (parity with crossbreed line 4960 — context is
     * intentionally suppressed via tags-whitelist for speed + schema discipline).
     *
     * @param {Object} metric1 - First source metric.
     * @param {Object} metric2 - Second source metric.
     * @returns {Promise<{id, name, desc}>}
     */
    async crossbreedMetric(metric1, metric2) {
        if (!metric1 || !metric2) throw new Error("Both source metrics required for crossbreed.");
        if (metric1.id === metric2.id) throw new Error("Cannot crossbreed a metric with itself.");

        log('AI', 'METRIC_ALCHEMY_CROSS_START', { m1: metric1.id, m2: metric2.id });
        Logger.userLog('LOG_INIT_METRIC_CROSS', 'initiated');

        State.set('is_crossbreeding_metric', true);

        const prompt = PromptCompiler.compile({
            persona: { id: 'alchemist', name: ALCHEMIST_VOICE_METRIC_CROSS.name, prompt: ALCHEMIST_VOICE_METRIC_CROSS.prompt },
            tags: ['CORE_MANDATE', 'STRATEGIC_OBJECTIVE', 'PERSONA_PROFILE', 'SOVEREIGN_IDENTITY_SCHEMA'],
            config: {
                type: 'metric_crossbreed',
                interactionType: 'metric_crossbreed',
                sigil: 'METRIC-CROSS',
                mode: 'dual',
                sourceMetric1: metric1,
                sourceMetric2: metric2
            }
        });

        log('AI', 'PROMPT_SYNTHESIZED', { prompt_length: prompt.raw.length, kind: 'metric_crossbreed' }, ['#prompt-injection']);

        try {
            const raw = await LLM.transmute(prompt.raw);

            let data = raw;
            if (typeof raw === 'string') {
                data = IntelligenceService.extractJson(raw);
            }
            let crossbred = Array.isArray(data) ? data[0] : data;

            if (crossbred && !crossbred.id && !crossbred.name) {
                if (Array.isArray(crossbred.metrics) && crossbred.metrics.length > 0) crossbred = crossbred.metrics[0];
                else if (crossbred.metric) crossbred = crossbred.metric;
            }

            if (!crossbred || !crossbred.name || !crossbred.desc) {
                throw new Error("Metric crossbreed result missing required {name, desc} fields.");
            }
            if (!crossbred.id || crossbred.id === metric1.id || crossbred.id === metric2.id) {
                crossbred.id = `mtr-${Date.now()}`;
            }

            log('AI', 'METRIC_ALCHEMY_CROSS_SUCCESS', crossbred);
            Logger.userLog('LOG_SUC_METRIC_CROSS', 'success');
            return crossbred;
        } catch (err) {
            log('e', 'METRIC_ALCHEMY_CROSS_FAIL', err.message);
            Logger.userLog('LOG_ERR_METRIC_CROSS', 'error');
            throw err;
        } finally {
            State.set('is_crossbreeding_metric', false);
        }
    },

    /**
     * Integrate a forged Metric into the user's metrics array and exit
     * management mode. Emits 'ALCHEMY_METRIC_INTEGRATION_SUCCESS' — a DEDICATED
     * channel separate from Persona's 'ALCHEMY_INTEGRATION_SUCCESS' so
     * Persona.alchemyIntegrationHandler stays untouched.
     *
     * @param {Object} metric - {id, name, desc} from synth/mutate/cross.
     */
    async integrateMetric(metric) {
        log('DATA', 'METRIC_ALCHEMY_INTEGRATE_START', metric.id);

        // Persistence (Atomic Storage Guard — explicit Storage.set bypasses State's
        // debounced _persist timer so the dispatch fires AFTER disk commit).
        const metrics = await Storage.get('metrics') || [];
        if (!metrics.find(m => m.id === metric.id)) {
            const created_order = (metrics.length > 0 ? Math.max(0, ...metrics.map(m => m.created_order || 0)) : 0) + 1;
            const newMetric = {
                id: metric.id || `mtr-${Date.now()}`,
                name: metric.name,
                desc: metric.desc || '',
                active: true,
                used: true,
                created_order
            };
            metrics.unshift(newMetric);
            State.set('metrics', metrics);
            await Storage.set({ metrics });
        }

        log('DATA', 'METRIC_ALCHEMY_INTEGRATE_COMPLETE', metric.id);
        Logger.userLog('LOG_SUC_METRIC_INTEGRATED', 'success');

        // Dedicated event channel — see header comment for audit §8.8 rationale.
        window.dispatchEvent(new CustomEvent('ALCHEMY_METRIC_INTEGRATION_SUCCESS', { detail: metric }));
    }
};