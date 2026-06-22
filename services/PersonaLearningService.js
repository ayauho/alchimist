/**
 * @file services/PersonaLearningService.js
 * @purpose Decoupled Intelligence Evolution & Persona Learning Substrate.
 */
import { log } from '../utils/logger.js';
import { Storage } from './Storage.js';
import { State } from './State.js';

export const IntelligenceService = {
    /**
     * Central extraction pipeline for structural data unboxing.
     */
    extractJson(raw) {
        if (typeof raw !== 'string') return raw;
        const firstBrace = raw.indexOf('{');
        const firstBracket = raw.indexOf('[');
        let match = null;
        
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            match = raw.match(/\{[\s\S]*\}/);
        } else if (firstBracket !== -1) {
            match = raw.match(/\[[\s\S]*\]/);
        }
        
        if (!match) return null;
        try { return JSON.parse(match[0]); } catch(e) { return null; }
    },

    /**
     * Processes AI-driven knowledge updates for Transmutations and Alchemical operations.
      *
      * @param {Object} response_data     - The parsed LLM response object.
      * @param {String} context_type      - 'transmutation' | 'refinement' | 'alchemy_mutate' | 'alchemy_crossbreed' | ...
      * @param {Object} [options]         - Optional processing hints.
      * @param {Array}  [options.startingKnowledge] - When provided, seed the working knowledge array from this
      *                                              instead of resolving the active persona from State/Storage.
      *                                              The seed is deep-cloned to sever upstream memory references.
      * @param {Boolean}[options.returnOnly] - When true, skip Storage/State persistence; just return the result.
      *                                       Used by Alchemy inheritance flows where the target persona does not
      *                                       yet exist in storage.
      * @returns {{added: Array, synthesized: Array, delta: Number, knowledge?: Array}}
     */
     async processLearningUpdates(response_data, context_type, options = {}) {
        const learningContexts = ['transmutation', 'refinement', 'alchemy_mutate', 'alchemy_crossbreed', 'mutate', 'crossbreed'];
        if (!learningContexts.includes(context_type) || !response_data) return;

        const reasoning = response_data.persona_knowledge_reasoning;
        if (reasoning) {
            log('AI', 'KNOWLEDGE_REASONING', { type: context_type, content: reasoning }, ['#knowledge-reasoning']);
        }

         // [V13] Generalized processing gate: the legacy Transmutation path (state-resolved persona +
         // Storage persistence) AND the new Alchemy inheritance path (caller-supplied seed + ephemeral
         // return) both flow through the same command interpreter below. The two paths are distinguished
         // exclusively by whether the caller passed options.startingKnowledge.
         const isEphemeralSeed = Array.isArray(options.startingKnowledge);
         const allowProcess = (context_type === 'transmutation') || isEphemeralSeed;
         if (allowProcess && Array.isArray(response_data.update_persona_knowledge)) {
             let knowledge;
             let personas = null;
             let personaIndex = -1;
             let personaId = null;

             if (isEphemeralSeed) {
                 // [V13.S³] Intelligence Isolation: Deep clone the caller-supplied seed so subsequent
                 // mutations cannot leak back into the caller's reference.
                 knowledge = JSON.parse(JSON.stringify(options.startingKnowledge));
             } else {
                 personaId = State.get('active_persona_id');
                 if (!personaId || personaId === 'none') {
                     log('w', 'KNOWLEDGE_SYNC', 'Abort: No active persona ID found.');
                     return;
                 }
                 personas = await Storage.get('personas') || [];
                 personaIndex = personas.findIndex(p => p.id === personaId);
                 if (personaIndex === -1) return;
                 knowledge = JSON.parse(JSON.stringify(personas[personaIndex].persona_knowledge || []));
             }

             const initialLen = knowledge.length;
             const _added = [];
             const _synthesized = [];

            for (const cmd of response_data.update_persona_knowledge) {
                if (!cmd || !cmd.command) continue;

                if (cmd.command === 'add' && cmd.element) {
                    const _newItem = { element: cmd.element, type: cmd.type || 'insight', confidence: cmd.confidence || 5 };
                    knowledge.push(_newItem);
                    _added.push(_newItem);
                } else if (cmd.command === 'remove' || cmd.command === 'delete') {
                    if (typeof cmd.index === 'number' && cmd.index >= 0 && cmd.index < knowledge.length) {
                        knowledge.splice(cmd.index, 1);
                    } else if (cmd.element) {
                        knowledge = knowledge.filter(k => k.element !== cmd.element);
                    }
                } else if (cmd.command === 'synthesize') {
                    // [V13.S³] Atomic Transformation: Incinerate parents, birth child
                    const toRemoveIndices = new Set();
                   
                    // 1. Identify Sources: Indices
                    if (Array.isArray(cmd.indexes)) {
                        cmd.indexes.forEach(idx => {
                            if (idx >= 0 && idx < knowledge.length) toRemoveIndices.add(idx);
                        });
                    }
                   
                    // 2. Identify Sources: Text formulations
                    if (Array.isArray(cmd.elements)) {
                        cmd.elements.forEach(el => {
                            const foundIdx = knowledge.findIndex(k => k.element === el);
                            if (foundIdx !== -1) toRemoveIndices.add(foundIdx);
                        });
                    }
                   
                    // 3. Atomic Incineration: Sort descending to preserve index stability during splice
                    const sortedIndices = Array.from(toRemoveIndices).sort((a, b) => b - a);
                    sortedIndices.forEach(idx => knowledge.splice(idx, 1));
                   
                    // 4. Transformation Birth: Inject the synthesized element after sources are removed
                    if (cmd.synthesis) {
                        const _newItem = { element: cmd.synthesis, type: cmd.type || 'synthesis', confidence: cmd.confidence || 9 };
                        knowledge.push(_newItem);
                        _synthesized.push(_newItem);
                    }
                }
            }

             // [V13] Persistence path: only the legacy Transmutation route writes back to Storage/State.
             // Alchemy inheritance is ephemeral — the caller will attach the returned knowledge to a
             // freshly-minted persona which will be persisted by AlchemyService.integrate() later.
             if (!options.returnOnly && !isEphemeralSeed && personaIndex !== -1 && personas) {
                 personas[personaIndex].persona_knowledge = knowledge;
                 await Storage.set({ 'personas': personas });
                 State.set('personas', personas);
             }

             log('DATA', 'KNOWLEDGE_EVOLVED', {
                 id: personaId || '(ephemeral)',
                 delta: knowledge.length - initialLen,
                 count: knowledge.length,
                 mode: isEphemeralSeed ? 'inherit' : 'persist'
             }, ['#knowledge-delta']);
             return { added: _added, synthesized: _synthesized, delta: knowledge.length - initialLen, knowledge };
        }
        return { added: [], synthesized: [], delta: 0 };
    }
 };