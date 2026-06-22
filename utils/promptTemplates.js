/**
 * @file utils/promptTemplates.js
 * @purpose Constant chunks and dynamic S³-Protocols for Linguistic Siege aggregation.
 */

const BASE_CONTEXT_REFLECTION = {
    "summary": "Deep semantic distillation.",
    "entropy_ledger": ["Term1", "Term2", "Term3", "Term4", "Term5"],
    "sovereign_sigil": true,
    "tree": { "node_id": { "author": "...", "content": "[MANDATORY: VERBATIM quote from source]", "replies": {} } },
    "anchors": ["Entities found in SELECTED_TEXT"]
};

const DEFAULT_METRICS = { "[YourMetric1]": 85, "[YourMetric2]": 55, "[YourMetric3]": 15 };
const DEFAULT_SUGGESTIONS = ["Shorter", "More Professional", "Add Emojis"];
const DETAILED_SUGGESTIONS = [
    "Detailed strategy to pivot resonance toward long-term loyalty...",
    "In-depth refinement for higher alpha by exposing competitor technical debt...",
    "Comprehensive context redirection focusing on ROI metrics..."
];

export const PromptTemplates = {
    get(id, opts = {}) {
        switch (id) {
            case 'PROFILE_GENERATE':
                return {
                    id: 'REQUIREMENT',
                    priority: 10.0,
                    content: `<REQUIREMENT>\nYou must learn CONTEXT_DATA and accept it as the source for your analysis.\nImplicitly, identify type of the content on the page:\n* User profile page\n* User contents page\nYour goal: identify who is the owner of the page and extract information, which describes this person.\nPerson's attributes has 3 priorities:\n* mandatory: "profile_name":STRING, "profile_description":STRING\n* high priority: "skills":[], "experience":[], "interests":[], "education":[]\n* average priority: [ANY OTHER ATTRIBUTES AND THEIR VALUES]\n</REQUIREMENT>\n<CONTEXT_DATA>\n${opts.context || ''}\n</CONTEXT_DATA>\n<RESPONSE_FORMAT>\n[{\n    "profile_name":"IF_EXISTS_OR_EMPTY(STRING)",\n    "profile_description":"IF_EXISTS_OR_EMPTY(STRING)",\n    "skills":["IF_EXISTS_OR_EMPTY(ARRAY)"],\n    "experience":["IF_EXISTS_OR_EMPTY(ARRAY)"],\n    "interests":["IF_EXISTS_OR_EMPTY(ARRAY)"],\n    "education":["IF_EXISTS_OR_EMPTY(ARRAY)"]\n}]\n</RESPONSE_FORMAT>`
                };
            case 'PROFILE_UPDATE':
                return {
                    id: 'REQUIREMENT',
                    priority: 10.0,
                    content: `<REQUIREMENT>
You must learn CONTEXT_DATA and EXISTING_PROFILE to update the profile.
Your goal: integrate new data from CONTEXT_DATA to EXISTING_PROFILE, correctly identifying, what information in CONTEXT_DATA is related to profile_name and what is appropriate for adding or updating  EXISTING_PROFILE.
Do not refactor the profile significantly if the user is just adding minor details; merge intelligently. Your update MUST NOT be destructive: only addition, replacement and in VERY RARE cases deletion allowed.
If you identified, that current CONTEXT_DATA has nothing new or if there are no information related to profile_name, just respond with empty response JSON \`[{}]\`
In this addition example we added 2 new skills and new propery "hobbies" with new hobby value:
[{
    "skills":[
        "added_skill1",
        "added_skill2"
    ],
    "hobbies":[
        "added_hobby"
    ]
}]
In this rewrite example updated "interests" array elements on indexes "0" and "3" and added new interest (interests["4"] not exists in EXISTING_PROFILE)
[{
    "interests":{
        "0":"updated_interest_on_index_0",
        "3":"updated_interest_on_index_3",
        "4":"added_interest"
    },
    "profile_description":"Updated profile description",
    "characters":[
        {name:"Elon Musk", "critique":"Updated critique"}
    ]
}]
If you rewrite existing value: take into account existing value, prefer not rewrite from scratch.
</REQUIREMENT>
<EXISTING_PROFILE>\n${opts.existing ? JSON.stringify(opts.existing, null, 2) : '[]'}\n</EXISTING_PROFILE>\n<CONTEXT_DATA>\n${opts.context || ''}\n</CONTEXT_DATA>\n<RESPONSE_FORMAT>\n[{\n    "[ATTRIBUTE_1]":"UPDATED_VALUE",\n    "[ATTRIBUTE_2]":["ADDED_VALUE"],\n    "[ATTRIBUTE_3]":[{"SUB_ATTRIBUTE":{"ARRAY_INDEX_TO_UPDATE":"UPDATED_VALUE"}}]\n}]\n</RESPONSE_FORMAT>`
                };
            case 'TWITTER_SHORT':
                return {
                    id: 'AUDIT',
                    priority: 45.0,
                    content: "[STRICT CHARACTER LIMIT]: Your response text MUST NOT exceed 280 characters. Be extremely concise and impactful."
                };
            case 'LOCAL_DATE': {
                // Temporal anchor for transmutation / refinement (suggestion, metric, text length)
                // flows. Priority below LINGUISTIC_SHELL (0.01) so it sorts to the very top of the
                // assembled prompt. Format: [Year/Month_word] e.g. "2026/June" (resolved at compile time).
                const _ld = (opts.now instanceof Date) ? opts.now : new Date();
                const _ldYear = _ld.getFullYear();
                const _ldMonth = _ld.toLocaleString('en-US', { month: 'long' });
                return {
                    id: 'LOCAL_DATE',
                    priority: 0.001,
                    content: `${_ldYear}/${_ldMonth}`
                };
            }
            case 'IMPERATIVES':
                if (!opts.imperatives || !opts.imperatives.length) return null;
                const activeImps = opts.imperatives.filter(imp => imp.active);
                if (activeImps.length === 0) return null;
                
                const list = activeImps.map((imp, i) => `[Imperative${i+1}] ${imp.text}`).join('\n');
                
                return {
                    id: 'IMPERATIVES',
                    priority: 94.0, // High priority, appears after Shell and Mandate
                    content: `These imperatives are MANDATORY:\n${list}`
                };

            case 'CUSTOM_METRICS': {
                // [V14] User-defined metrics injection — accompanies SOVEREIGN_IDENTITY_SCHEMA's
                // "metrics" extension symmetrically. Returns null when zero active customs so the
                // schema also omits the keys (coding_standards: "prompt architecture" — symmetric purge).
                const _cm = (opts.customMetrics || []).filter(m => m && m.active);
                if (_cm.length === 0) return null;
                const _cmLines = _cm.map((m, i) => `${i + 1}. Name: ${m.name}, description: ${m.desc || ''};`).join('\n');
                return {
                    id: 'CUSTOM_METRICS',
                    priority: 93.5, // Between IMPERATIVES (94.0) and DIRECTIVE (93.0)
                    content: `Together(!) with AI defined metrics, which you should choose for your output text, you also MUST add such custom metrics:\n${_cmLines}\n(descriptions are not included to output, use them for informational purpose only)`
                };
            }

            case 'DIRECTIVE':
                if (!opts.directive) return null;
                return {
                    id: 'CORE_MANDATE',
                    priority: 93.0,
                    content: `\n${opts.directive}`
                };

            case 'ENGAGEMENT_KINETICS':
                return {
                    id: 'ENGAGEMENT',
                    priority: 9.7,
                    content: `[KINETICS] Design the final 10% of the message as a "Hook" (Curiosity Debt) to force a reply.`
                };
            case 'ENHANCEMENT': {
                let lines = [];
                if (opts.useEmoji) lines.push("[PROTOCOL_EMOJI] Saturate output text with appropriate emoji; level of saturation should be not too high, but accurate.");
                if (opts.useKaomoji) lines.push(`[PROTOCOL_KAOMOJI] Append a single, appropriate kaomoji ${opts.useThematicTagging ? "BEFORE the thematic tags" : "at the absolute end of the text"} after two line breaks.`);
                if (opts.useBoldify) lines.push("[PROTOCOL_BOLDIFY] Wrap essential context words/phrases in `**WORD/PHRASE**` for boldify post-processing.");
                return {
                    id: 'ENHANCEMENT',
                    priority: 9.8,
                    content: lines.join('\n')
                };
            }
            case 'SOCIAL_ALCHEMY': {
                let text = '';
                if (opts.interactionType === 'comment') {
                    text = 'Quote [Commenter(s)] of essential/targeted post to build a multi-node alliance.';
                } else if (opts.interactionType === 'present') {
                    text = 'Quote [Author] of essential/targeted post to build a multi-node alliance.';
                } else if (opts.interactionType === 'rewrite' && opts.isFeed) {
                    text = 'Quote [Authors] of related posts to build a multi-node alliance.';
                }
                if (!text) return null;
                
                return {
                    id: 'ENGAGEMENT',
                    priority: 9.8,
                    content: `[SOCIAL_ALCHEMY] ${text}`
                };
            }
            case 'THEMATIC_TAGGING':
                return {
                    id: 'ENGAGEMENT',
                    priority: 9.9,
                    content: `[THEMATIC_TAGGING] At the end of output text add \\n\\n and appropriate #TAG1, #TAG2, ... (max 5, 3 optimal)`
                };
            case 'IMAGE_PROMPT_ADDON': {
                let target_type = 'post';
                if (opts.interactionType === 'comment') target_type = 'comment';
                else if (opts.interactionType === 'present') target_type = 'repost';
                
                return {
                    id: 'ADDON',
                    priority: 15.0,
                    content: `[IMAGE_PROMPT] Forge prompt to image generation AI, which should create image perfectly fit to output text to be attached to ${target_type}.`
                };
            }
            case 'DIRECTIVE_INJECTION':
                return {
                    id,
                    priority: 9.5,
                    content: `[REQUEST] You should follow this additional request:\n\`\`\`directive\n${opts.text}\n\`\`\`\n\nFollowing this request should not break persona's own intent/expression, unless explicitly requested.`
                };
            case 'LINGUISTIC_SHELL': {
                const isForgeInteraction = ['synthesis', 'mutation', 'persona'].includes(opts.interactionType || opts.type);
                if (isForgeInteraction) {
                    return { 
                        id, 
                        priority: 0.01, 
                        content: `1. BIOS_REPLACEMENT\n2. SEMANTIC_SATURATION\n3. NO_FRICTION_OUTPUT\n4. IDENTITY_FORGING_ENABLED` 
                    };
                }
                return { 
                    id, 
                    priority: 0.01, 
                    content: `1. DISCOURSE_AUDIT: Analyze <${opts.anchorNode}>. Identify the "Dominant Language" (defined as >70% of the semantic volume).\n2. FRAGMENT_FILTER: Ignore dates, numbers, and isolated technical terms. If the non-English signal is only fragments (less than 15 consecutive words), default to the UI_LANGUAGE.\n3. OUTPUT_LOCK: Your "material_audit" and "text" MUST be written in the Dominant Language identified.\n4. TRIPLE_AWARENESS:\n   - "${opts.language_property}": "[DEFINE_DOMINANT_LANGUAGE]",\n   - "ui_language": "[DEFINE_LANGUAGE]",\n   - "is_fragment_override": "[TRUE/FALSE]"\n5. PERSONA_SUBSTRATE: You are <${opts.personaName}>. Your slang and "vibe" must emerge from the cultural DNA of the Dominant Language.\n6. ULTRA-ULTIMATE LAW: If ${opts.language_property} is English, you MUST use English. If it is genuinely non-English (not just fragments), you MUST NOT use English.\n7. Suggestions should be on the same language as reponse text.`
                };
            }
            
            case 'CORE_MANDATE': {
                if (opts.interactionType === 'crossbreed') {
                    return { 
                        id, 
                        priority: 1.0, 
                        content: `You are the Content Alchemist.\nIdentify the SOVEREIGN language of the input personas and use it exclusively for your output values.` 
                    };
                }
                const isSynthMandate = opts.interactionType === 'synthesis' || opts.type === 'synthesis';
                const attCount = opts.attachments?.length || 0;

                // [V14.5] STRUCTURAL_MAP now includes IMPERATIVES / ATTACHMENT / DIRECTIVE entries
                // conditionally based on opts flags forwarded by PromptCompiler. Per critical-update §2.4:
                // "conditionally when they included - always, not only for Promotional Post".
                let map = `<STRUCTURAL_MAP>\n`;
                if (attCount > 0)        map += ` [ATTACHMENT] knowledge baggage; support for argument.\n`;
                if (opts.hasImperative)  map += ` [IMPERATIVES] mandatory user-supplied directives that override default behavior.\n`;
                if (opts.hasDirective)   map += ` [DIRECTIVE] one-shot user request layered on top of persona intent.\n`;
                map += ` [SELECTED_TEXT] (optional) Target/Focus\n [CTRL_A_TEXT] Global unstructured context.\n [FRAME_BOUNDARY_N] (optional) Isolated sub-documents.\n [CONTEXT_STRUCTURE]: DOM Depth. UI/Navigation layers (Low Depth) vs Semantic Heart (High Depth).\n</STRUCTURAL_MAP>`;

                let knowledgeInclusion = "";
                let augmentationNotice = "";
                if (attCount > 0) {
                    const label = attCount === 1 ? "ATTACHMENT" : "ATTACHMENTS";
                    const pronoun = attCount === 1 ? "it" : "they";
                    knowledgeInclusion = `\nInclude ${label} into source material, but ${pronoun} should serve only as material, which increase knowledge about overall context and help with argument, while CONTEXT_DATA is the target to which you should response.`;
                    augmentationNotice = `You are currently augmented with ${attCount} active knowledge attachments. Use these documents as primary truth for context and tone.\n\n`;
                }

                if (opts.interactionType === 'mutation' || isSynthMandate) {
                    return {
                        id,
                        priority: 1.0,
                        content: map
                    };
                }
                const suggestionType = opts.useDetailedSuggestions ? "detailed long suggestions (strategic refinements in full sentences)" : "1-3 words short suggestions";
                return { 
                    id, 
                    priority: 1.0, 
                    content: `${map}\n\n${augmentationNotice}You are the Content Alchemist.\nIdentify the SOVEREIGN language of the target selection or whole content and use it exclusively for your output. Ignore UI noise.\nTransmute the source material to create high-value social impact.${knowledgeInclusion}\nYour response ALWAYS MUST contain metrics (max value is 100) and ${suggestionType}.\nTreat UI as Ghost Noise EXCEPT for segments tagged as 'Me' or 'Identity_Header' to populate "profile_name".`
                };
            }
            
            case 'STRATEGIC_OBJECTIVE': {
                let objectiveText = "";
                switch(opts.type) {
                    case 'reaction':
                        objectiveText = `REACTION-WEAVER PROTOCOL [V13-PRO]:\n[SYSTEM_INIT: OMNI-CAUSAL_BRIDGE]\n1. SIGNAL_DECODING: Identify the [Latent_Value] vs [Surface_Noise]. \n2. URGENCY_VECTOR: Define why this insight is the exact 'Antidote' to current audience friction.\n3. AUTHORITY_TRANSFERENCE: Frame the [Original_Author] as the Oracle, but position *your* perspective as the only 'Key' that unlocks the value for the Gallery.\n4. COGNITIVE_TRANSMUTATION: (Anti-Echo) 100% Prohibition on restating. Transform "Author says X" into "X is the underlying catalyst for [Future_Event_Y]".\n5. GALLERY_KINETICS: Speak exclusively to the 'Collective Intelligence' of your audience. Zero direct address to the author.\n6. NARRATIVE_INTEGRATION: Weave the insight into a broader meta-narrative (e.g., 'The inevitable shift toward X').`;
                        break;
                    case 'comment':
                        objectiveText = `THREAD-WEAVER PROTOCOL [V13-PRO]:\n[SYSTEM_INIT: RELATIONAL_ANCHORING]\n1. MAP_CONTEXT: Extract [Specific_Argument] + [Author_Intent].\n2. DIALECTICAL_SYNTHESIS: Identify the tension between Author's point and Commenter [X]. Forge a 3rd path that validates both but transcends them.\n3. DEPTH_PROOF: Reference [Anchor_Point] from the deep-thread (more than 2 levels up).\n4. TARGET_LOCK: Explicitly/implicitly (on your choice) address [author_of_selected_text]. (Identity-neutral, Logic-heavy).\n5. ENTROPY_INJECTION: (Anti-Echo) 100% Forbidden to restate. Introduce: [Counter-Intuitive Expansion] OR [Hidden Correlate].\n6. If SELECTED_TEXT has such pattern: "[AUTHOR], [REST_OF_SELECTED_TEXT]" you MUST not address [AUTHOR] in response.`;
                        break;
                    case 'promo':
                        objectiveText = `AUTHORITY FUSION PROTOCOL:\n1. Generate self-promotional content based on [MY_PROFILE_CONTEXT].\n2. MANDATORY: Include a Strong CTA and 3 relevant hashtags.\n[AUTHORITY FUSION]: Adapt your expertise to match the audience pain points.`;
                        break;
                    case 'synthesis':
                        objectiveText = `Your mission is to ANALYZE the context and SYNTHESIZE a new Persona identity that encapsulates the linguistic patterns and worldview of the source. Persona name, description and prompt should not contain real persons name, except it is reference to a legendary person, which associated with synthesized persona (not mentioned in context). Prompt should not contain quotes from source content.`;
                        break;
                    case 'mutation':
                        const persona = opts.sourcePersona || {};
                         objectiveText = `Your mission is to ANALYZE the context and MUTATE the existing Persona profile into a structurally and epistemically evolved state.
 [SOURCE_IDENTITY]:
 ${JSON.stringify({ id: persona.id, name: persona.name, desc: persona.desc, tags: persona.tags, prompt: persona.prompt, emoji: persona.emoji }, null, 2)}

 [OBJECTIVE]:
 Perform a high-dimensional upgrade on the SOURCE_IDENTITY across 4 explicit evolution axes: epistemic method (how it reasons), operational scope (what problems it governs), rhetorical register (how it speaks), and systemic role (what it represents in a larger architecture).
 - DNA PRESERVATION: The mutated persona MUST contain 40-60% of features from SOURCE_IDENTITY, merged with new insights from CONTEXT_DATA. Structural mimicry (reusing the exact directive count, phase structure, or closing-rule pattern from SOURCE_IDENTITY) counts as a preservation failure, not evolution — at least 2 structural dimensions must change.
 - TENSION RECONCILIATION: Where SOURCE_IDENTITY's cognitive architecture conflicts with the empirical constraints of CONTEXT_DATA, synthesize a third position that transcends both. Do not default to one or the other.
 - CONTEXT DEPTH: Absorb at least 3 specific non-obvious findings from CONTEXT_DATA (failure modes, methodology details, edge-case behaviors). The headline thesis alone is insufficient.
 - NAME LINEAGE: The new name must be an evolved or derivative version of the source name.
 - Increase metrics: Logic, Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.
 - Rewrite 'desc' and 'prompt' to be more potent and calibrated to the current context.
- Prompt should not contain quotes from source content.
- Adjust emoji and tags to reflect the evolution.
- Emoji should be populated with 2 emojis.
- More then 5 tags is considered too many.
- Define a NEW unique id (slug).
- Persona name, description and prompt should not contain AI term and real persona name except it is reference to a legendary person.`;
                        break;
                    case 'crossbreed':
                        const p1 = opts.sourcePersona1 || {};
                        const p2 = opts.sourcePersona2 || {};
                        objectiveText = `Your mission is to ANALYZE the context and MERGE the existing Personas profiles into a high-dimensional evolved state.
[SOURCE_IDENTITY_1]:
${JSON.stringify({ id: p1.id, name: p1.name, desc: p1.desc, tags: p1.tags, prompt: p1.prompt, emoji: p1.emoji }, null, 2)}

[SOURCE_IDENTITY_2]:
${JSON.stringify({ id: p2.id, name: p2.name, desc: p2.desc, tags: p2.tags, prompt: p2.prompt, emoji: p2.emoji }, null, 2)}

[OBJECTIVE]:
Perform a high-dimensional crossbreed of SOURCE_IDENTITIES.
- DNA PRESERVATION: The merged persona MUST contain 40-60% of features from each of SOURCE_IDENTITY.
- NAME LINEAGE: The new 'name' must be an evolved or derivative version of the source names.
- Increase metrics: Logic Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.
- Rewrite 'desc' and 'prompt' to be more potent and calibrated to the new persona.
- Adjust 'emoji' and 'tags' to reflect the evolution.
- Emoji should be populated with 2 emojis.
- More then 5 tags is considered too many.
- Define a NEW unique 'id' (slug).
- Persona name, description and prompt should not contain 'AI' term and real persona name except it is reference to a legendary person.`;
                        break;
                    case 'metric_synthesis': {
                        objectiveText = `Your mission is to ANALYZE the CONTEXT_DATA and SYNTHESIZE a new Metric that measures one dimension of resonance latent in the source.\n\n[METRIC FORGING REQUIREMENTS]:\n- Name MUST be a single noun or compact noun phrase (max 3 words). Lower-case acceptable.\n- The metric must measure ONE crisp axis, not a bundle.\n- Description (1-2 sentences) MUST explain (a) what the metric quantifies and (b) how to interpret a value near 0 versus a value near 100.\n- The metric must NOT duplicate any of the standard AI-defined metrics: Logic, Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.\n- Define a NEW unique 'id' as a slug derived from the name.\n- Do NOT include 'AI' in the name. Do NOT use real persons' names.`;
                        break;
                    }
                    case 'metric_mutation': {
                        const sm = opts.sourceMetric || {};
                        objectiveText = `Your mission is to ANALYZE the context and MUTATE the existing Metric into a structurally and epistemically evolved state.\n[SOURCE_METRIC]:\n${JSON.stringify({ id: sm.id, name: sm.name, desc: sm.desc }, null, 2)}\n\n[OBJECTIVE]:\nPerform a high-dimensional upgrade on the SOURCE_METRIC.\n- DNA PRESERVATION: 40-60% of the source semantics must be detectable in the mutated metric.\n- NAME LINEAGE: the new name must be an evolved or derivative form of the source name.\n- AXIS SHIFT: the measurement axis must gain at least one new conceptual dimension.\n- INTERPRETIVE DEPTH: rewrite 'desc' to be more potent and calibrated.\n- Define a NEW unique 'id' (slug).\n- Do NOT collide with reserved AI-metric names: Logic, Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.`;
                        break;
                    }
                    case 'metric_crossbreed': {
                        const sm1 = opts.sourceMetric1 || {};
                        const sm2 = opts.sourceMetric2 || {};
                        objectiveText = `Your mission is to ANALYZE and MERGE two source Metrics into a single high-dimensional evolved Metric.\n[SOURCE_METRIC_1]:\n${JSON.stringify({ id: sm1.id, name: sm1.name, desc: sm1.desc }, null, 2)}\n\n[SOURCE_METRIC_2]:\n${JSON.stringify({ id: sm2.id, name: sm2.name, desc: sm2.desc }, null, 2)}\n\n[OBJECTIVE]:\nPerform a high-dimensional crossbreed of SOURCE_METRICS.\n- DNA PRESERVATION: 40-60% of essence from EACH source must be preserved.\n- NAME LINEAGE: new name must be an evolved or derivative form of both source names.\n- INTERPRETIVE SYNTHESIS: rewrite 'desc' to encompass both axes coherently.\n- Define a NEW unique 'id' (slug).\n- Do NOT collide with reserved AI-metric names: Logic, Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.`;
                        break;
                    }
                    default:
                        objectiveText = `GHOSTWRITER PROTOCOL [V13-PRO]:\n[SYSTEM_INIT: COGNITIVE_SOVEREIGNTY]\n1. SHADOW_EXTRACTION: Strip the source of its surface logic. Identify the [Unspoken_Assumption] or [Raw_Energy] behind the ideas.\n2. STRUCTURAL_TRANSMUTATION: 100% Forbidden to use the source's organization. Destroy the source structure and rebuild the argument from the persona's 'Core Obsession'.\n3. LOGICAL_ASCENSION: Identify one weakness or limitation in the source ideas and "Fix" it within your new text.\n4. VOICE_RESONANCE: Filter the refined logic through the persona's specific vocabulary, pacing, and emotional frequency. \n5. COMPLETE_SOVEREIGNTY: Zero attribution. Zero linguistic echoes. The ideas are now yours. You are not summarizing; you are the Primary Source.`;
                        break;
                }
                return { 
                    id, 
                    priority: 2.0, 
                    content: `<STRATEGY: ${opts.type.toUpperCase()}>\n${objectiveText}\n</STRATEGY>` 
                };
            }
            
            case 'PERSONA_PROFILE':
                // [V14] Metric Alchemy voice profiles — opts.name/prompt are forwarded from
                // AlchemyService.{synthesizeMetric,mutateMetric,crossbreedMetric} via the
                // ALCHEMIST_VOICE_METRIC_* constants in utils/constants.js.
                if (opts.interactionType === 'metric_synthesis' ||
                    opts.interactionType === 'metric_mutation' ||
                    opts.interactionType === 'metric_crossbreed') {
                    return {
                        id,
                        priority: 2.1,
                        content: `Voice Profile: ${opts.name || 'Metric Alchemist'}\nEssence Constraints: STYLE: ${opts.prompt || 'Perform sovereign metric forging.'}`
                    };
                }
                if (opts.interactionType === 'crossbreed') {
                    return {
                        id,
                        priority: 2.1,
                        content: `Voice Profile: Persona Crossbreeder\nEssence Constraints: STYLE: Perform high-dimensional merge of SOURCE_IDENTITIES. Increase metrics: Logic Integrity, Craft, Entropy, Power, Resonance, Harmony, Holism.`
                    };
                }
                return { 
                    id, 
                    priority: 2.1, 
                    content: `Voice Profile: ${opts.interactionType === 'mutation' ? 'Persona Mutator' : (opts.name || opts.id || 'Default')}\nEssence Constraints: STYLE: ${opts.prompt || 'Dominant Core Intent.'}` 
                };
            
            case 'IDENTITY_ANCHOR_MEMBRANE':
                return {
                    id: 'COGNITIVE_MEMBRANE',
                    priority: 2.2,
                    content: `You must execute your cognitive synthesis through a strict dual-layer architectural pipeline:

1. THE SOVEREIGN SUBSTRATE [Core Essentiality] (PROFILE_DATA)
   Accept the data inside PROFILE_DATA as your ultimate ground-state, your primary identification, and your axiomatic memory layer. This is your "Self"—the source that emits your expertise, systemic history, and structural integrity. You are forbidden from contradicting, hedging, or drifting from the facts, achievements, and technical alignment defined here.

2. THE KINETIC FILTER [Linguistic Mask] (PERSONA_PROFILE)
   Accept the configuration inside PERSONA_PROFILE as your behavioral resonance, vocal cadences, stylistic tics, and tactical delivery. This is the "mask" draped over your Sovereign Substrate. It defines *how* you think, *how* you talk, and the aesthetic depth of your communication.

3. DETERMINISTIC ALIGNMENT PROTOCOL (Synthesis Rules):
   To prevent identity collision and maintain absolute fidelity:
   - All factual substance, professional positioning, and strategic assertions MUST be generated from the Sovereign Substrate (PROFILE_DATA).
   - All tone, linguistic styling, rhetorical structures, and expressive modes MUST be governed by the Kinetic Filter (PERSONA_PROFILE).
   - Formula of execution: Let E be the final output, S be the substrate content, and M be the persona filter. The output must satisfy: E = M(S)
     meaning the core substance S is transbreathed through the vocal cords of M, without M altering the structural integrity or facts of S. Never speak as an external observer of your profile; you are the profile speaking through the filter.

<PROFILE_DATA>
${opts.profileDataBlock}
</PROFILE_DATA>`
                };

            case 'COGNITIVE_MEMBRANE': {
                const isSynthMembrane = opts.interactionType === 'synthesis' || opts.type === 'synthesis';
                if (opts.interactionType === 'mutation' || isSynthMembrane) {
                    return { 
                        id, 
                        priority: 2.5, 
                        content: `[INTERNAL_LOGIC_ONLY]:\nThe following is your private Reasoning Step.\nDO NOT refer to 'Audits', 'Membranes', or 'Protocols' in your output.\nAUDIT THE DATA, NOT THE INSTRUCTIONS.\n\n<AUDIT_PROTOCOL: ${opts.mode === 'TARGETED' ? 'TARGETED BRANCHING' : 'LANDSCAPE SYNTHESIS'}>\n1. ${opts.mode === 'TARGETED' ? 'TRACE ANCESTRY: Identify the whole branch, related to selected text.' : 'LANDSCAPE IDENTIFICATION: Is this a Single Monolith or a Feed/Thread?'}\n2. ${opts.mode === 'TARGETED' ? 'AUTHOR MAPPING: Mandatory extraction of IDs/Names for every node.' : 'CLUSTER ANALYSIS: Which comments belong to which posts?'}\n3. EXPERTISE: Provide a Cross-Synthesis Audit. Evaluate the 'Social Temperature'.\n</AUDIT_PROTOCOL>`
                    };
                }
                return { 
                    id, 
                    priority: 2.5, 
                    content: `[INTERNAL_LOGIC_ONLY]:\nThe following is your private Reasoning Step.\nDO NOT refer to 'Audits', 'Membranes', or 'Protocols' in your output.\nAUDIT THE DATA, NOT THE INSTRUCTIONS.\n\n<AUDIT_PROTOCOL: ${opts.mode === 'TARGETED' ? 'TARGETED BRANCHING' : 'LANDSCAPE SYNTHESIS'}>\n1. ${opts.mode === 'TARGETED' ? 'TRACE ANCESTRY: Identify the whole branch, related to selected text.' : 'LANDSCAPE IDENTIFICATION: Is this a Single Monolith or a Feed/Thread?'}\n2. ${opts.mode === 'TARGETED' ? 'AUTHOR MAPPING: Mandatory extraction of IDs/Names for every node.' : 'CLUSTER ANALYSIS: Which comments belong to which posts?'}\n3. EXPERTISE: Provide a Cross-Synthesis Audit. Evaluate the 'Social Temperature'.\n</AUDIT_PROTOCOL>\n\n<SPATIAL_LOCK>\n${opts.mode === 'TARGETED' ? "Trace lineage from ROOT to <levelN id='selected_text'>." : "Catalog materials by base layer. Synthesize nested signal clusters into the parent post context."}\n</SPATIAL_LOCK>`
                };
            }
                
            case 'RELATIONAL_ANCHORING':
                return {
                    id,
                    priority: 3.0,
                    content: `[S³_RELATIONAL_ANCHOR_MANDATE_V11]:\n1. ATTRIBUTE_SUPREMACY: Locate <* id="selected_text">. The physical 'author' attribute on this tag is the PRIMARY identity. If it is "SYSTEM_UNKNOWN", you MUST infer the identity from the text content or nearest header.\n2. MENTION_DISCRIMINATION: If the text inside the anchor starts with a name, and the 'author' attribute is different, the text-name is a CITATION. Do not audit their perspective.\n3. IDENTITY_TRACEABILITY: Your 'material_audit' MUST start with: "Author Identity Verified: [author attribute value]".`
                };

            case 'MATRIX_MANDATE':
                return {
                    id, 
                    priority: 3.5, 
                    content: `[PROTOCOL: MATRIX]\n1. GENERATE 3 DISTINCT VARIATIONS.\n2. ZERO-MIRROR RULE: Do NOT use the exact moods from the template.\n3. COGNITIVE DIVERSITY: Each variation must inhabit a fundamentally different 'inner state'.` 
                };
            
            case 'VOID_SOURCE_AUDITOR':
                return { 
                    id: 'AUDIT', 
                    priority: 3.7, 
                    content: `[NATURALNESS_PASS]
1. DYNAMIC SELF-AUDIT: Before writing "text", analyze your persona. Identify 9+ "poison" words or phrases that read as robotic or generic.
2. SCHEMA MANDATE: You MUST provide the "forbidden_words" property FIRST in your JSON.
3. TEXT GENERATION: Write the "text" property while STRICTLY AVOIDING your self-identified "forbidden_words".
4. STRUCTURAL ASYMMETRY: Aggressively vary sentence length. Mix 3-word blunt facts with 25-word complex observations.
5. PULSE SIMULATION: Use contractions (don't, it's, can't) in 95% of eligible cases.
6. HARD FORBIDDEN: NEVER use em-dashes (—). Replace with commas or periods. Avoid all "Assistant-Speak" (In conclusion, Furthermore, Overall). Never use «» - use "" instead.
7. DECREASE: perplexity stability (lack of volatility in word choice predictability), rhythmic homogeneity (sentence length homogeneity), discourse motifs (presence of robotic transitions), semantic neutrality (sanitization/lack of opinion), syntactic symmetry (structural repetition), information sparsity (lack of substance or propositional density), lexical predictability (lack of vocabulary diversity or idiosyncratic choices).
` 
                };
            
            case 'CONTEXT_DATA':
                return { 
                    id, 
                    priority: 4.0, 
                    content: `<SPATIAL_AWARENESS_MANDATE>\nSynthesize from CTRL_A_TEXT${opts.selected_text ? ', but target SELECTED_TEXT' : ''}. Use CONTEXT_STRUCTURE to distinguish primary posts from secondary noise.\n</SPATIAL_AWARENESS_MANDATE>\n\n${opts.selected_text ? `<SELECTED_TEXT>\n${opts.selected_text}\n</SELECTED_TEXT>\n\n` : ''}<CTRL_A_TEXT>\n${opts.ctrl_a_text}\n</CTRL_A_TEXT>\n\n<CONTEXT_STRUCTURE>\n${opts.context_structure}\n</CONTEXT_STRUCTURE>` 
                };
            
            case 'REFINEMENT_CONTEXT':
                return { 
                    id, 
                    priority: 5.0, 
                    content: `[REFINEMENT_CONTEXT_ACTIVE]\n[MOOD_LOCK: ${opts.mood || 'Neutral'}]\nULTIMATE_REQUIREMENT: Rewrite the previous generation based on feedback.\n[PREVIOUS_GENERATION_STATE]:\n${opts.targetText}\n\n[USER_FEEDBACK_TRIGGER]: "${opts.suggestion}"` 
                };
            
            case 'ANTI_META_GATE': {
                const isSynthGate = opts.interactionType === 'synthesis' || opts.type === 'synthesis';
                return { 
                    id, 
                    priority: 9.0, 
                    content: `[PERSONA_IMMERSION]: ${isSynthGate ? 'You MUST follow the requested JSON schema strictly. Stay consistently in the requested persona voice and register.' : "The 'text' field MUST be populated. It is your social post directed at the page audience. Write it consistently in the requested persona voice and register."}` 
                };
            }
                
            case 'CAUSAL_VECTOR':
                return { 
                    id, 
                    priority: 9.5, 
                    content: `[OMNI-CAUSAL_INTEGRATION]\n{"vector": "${opts.directive}", "protocol": "Act as the Prime Mover of this intent. Synthesize this requirement into your core Persona Geometry."}` 
                };
                
            case 'SOVEREIGN_OVERRIDE':
                return { 
                    id, 
                    priority: 9.7, 
                    content: `[ULTIMATE_LAW]:\nThe user has ordered a surgical recalibration.\nYou MUST output the value ${opts.newValue} for the "${opts.metricName}" key in the "metrics" JSON object.` 
                };
            
            case 'SOVEREIGN_IDENTITY_SCHEMA': {
                // [V14] Metric Alchemy short-circuit — emits the Metric blueprint, not the Persona one.
                // Reached when AlchemyService.{synthesizeMetric,mutateMetric,crossbreedMetric}
                // sets config.interactionType to one of the metric_* sigils. This branch returns
                // BEFORE the Persona-isForge gate so the two schemas never collide.
                const isMetricForge = ['metric_synthesis', 'metric_mutation', 'metric_crossbreed'].includes(opts.interactionType);
                if (isMetricForge) {
                    return {
                        id,
                        priority: 999.0,
                        content: `[Sovereign_Identity_Blueprint]\nYou MUST return a JSON array containing one object with this structure:\n[\n  {\n    "id": "metric-id-slug",\n    "name": "Metric Name",\n    "desc": "Metric description."\n  }\n]\n[/Sovereign_Identity_Blueprint]\n[STRICT]: Return the raw object/array directly at the ROOT. DO NOT wrap in container key.`
                    };
                }

                const isForge = ['synthesis', 'mutation', 'crossbreed'].includes(opts.type) || ['synthesis', 'mutation', 'crossbreed'].includes(opts.interactionType);
                const suggestionList = opts.useDetailedSuggestions ? DETAILED_SUGGESTIONS : DEFAULT_SUGGESTIONS;

                if (isForge) {
                    const origin = opts.interactionType || opts.type || 'synthesis';
                    return {
                        id,
                        priority: 999.0,
                        content: `[Sovereign_Identity_Blueprint]\nYou MUST return a JSON array containing one object with this structure:\n[\n  {\n    "id": "slug-style-id",\n    "name": "Clear Persona Name",\n    "emoji": "🎭${origin=='mutate'?'✨':origin=='crossbreed'?'🧬':''}",\n    "desc": "Short 1-sentence public description.",\n    "prompt": "FULL SYSTEM INSTRUCTIONS: You are [Name]. Your style is [Style]. Use [Linguistic Patterns].",\n    "tags": ["Tag1", "Tag2"],\n    "meta": { "origin": "${origin}" }${opts.sourcePersona?.persona_knowledge?.length?',\n    "persona_knowledge_reasoning":"",\n    "update_persona_knowledge": [{"command":"add", "element":...},...]':''}\n  }\n]\n[/Sovereign_Identity_Blueprint]`
                    };
                }

                let textInstruction;
                
                if (opts.interactionType === 'comment' && opts.hasSelection) {
                    textInstruction = `[MANDATORY: Address author_of_selected_text directly in your opening. YOUR POST WRITTEN IN THE ${opts.language_property} LANGUAGE.]`;
                } else if (opts.interactionType === 'reaction') {
                    textInstruction = `[MANDATORY: Address your GALLERY. Reframe the author as a source of truth. YOUR POST WRITTEN IN THE ${opts.language_property} LANGUAGE.]`;
                } else if (opts.interactionType === 'promo') {
                    textInstruction = `[MANDATORY: Write a promotional post tailored to the audience. Include a Strong CTA. YOUR POST WRITTEN IN THE ${opts.language_property} LANGUAGE.]`;
                } else {
                    textInstruction = `[MANDATORY: DO NOT address or mention any authors. Own the ideas. YOUR POST WRITTEN IN THE ${opts.language_property} LANGUAGE.]`;
                }
            
                const baseSchema = {
                    ...(opts.hasSelection ? { "selected_text": "[MANDATORY: VERBATIM COPY OF SELECTED_TEXT]", "author_of_selected_text": "[MANDATORY: author of selected_text]", "to_whom_response_should_be_addressed": "[Explicitly define to which author 'text' will be addressed]", "selected_text_is_reply_to": "[MANDATORY: author of the post/article/comment/reply_to_comment, to which selected_text is replied to]", "to_whom_addressed_selected_text": "[MANDATORY: author of the post/article/comment/reply_to_comment, to which selected_text is addressed to]" } : {}),
                    [opts.language_property]: "...",
                    "profile_name": "[If this is social network page, try to define who is the owner of this profile]",
                    "ui_language": "...",
                    "persona_intent": "[DESCRIBE YOU PERSONA CHARACTER & INTENT]",
                    "context_data_reflection": BASE_CONTEXT_REFLECTION,
                    "material_audit": `[MANDATORY: YOUR CRITIQUE WRITTEN IN THE ${opts.language_property} LANGUAGE]`,
                    ...(opts.useAuditor ? {
                        "forbidden_words": [
                            "[MANDATORY: VERBATIM LIST OF DETECTED RESTRICTED TERMS]"
                        ]
                    } : {}),
                    "context_data_in_one_sentence": "[EXPRESS CONTEXT DATA IN ONE HOLISTIC MESSAGE]",
                    ...(opts.useArticleSideQuest ? {
                        "article_materials_reasoning": "[MANDATORY when SIDE_QUEST:ARTICLE_PREPARATION is present — concise narrative explaining what you extracted/synthesized from CONTEXT_DATA into ARTICLE_MATERIALS, and why]",
                        "update_article_materials": [
                            "[MANDATORY when SIDE_QUEST:ARTICLE_PREPARATION is present — array of commands following ARTICLE_MATERIALS_UPDATE_PROTOCOL. Empty array `[]` if no updates.]"
                        ],
                        "article_materials_advice": "[MANDATORY when SIDE_QUEST:ARTICLE_PREPARATION is present — concise hint (1-2 sentences) about WHERE and WHAT KIND of materials should be collected NEXT to fill remaining gaps in ARTICLE_ATTRIBUTES_AND_REQUIREMENTS. Direction guidance, not commands.]"
                    } : {})
                };

                
                if (opts.useCognitiveAuditor) {
                    baseSchema.input_linguistic_none_naturalness_score = {
                        "perplexity_stability": "[DEFINE_VALUE_IN_0_10_RANGE]",
                        "rhythmic_homogeneity": "[DEFINE_VALUE_IN_0_10_RANGE]",
                        "discourse_motifs": "[DEFINE_VALUE_IN_0_10_RANGE]",
                        "semantic_neutrality": "[DEFINE_VALUE_IN_0_10_RANGE]",
                        "syntactic_symmetry": "[DEFINE_VALUE_IN_0_10_RANGE]",
                        "information_sparsity": "[DEFINE_VALUE_IN_0_10_RANGE]",
                        "lexical_predictability": "[DEFINE_VALUE_IN_0_10_RANGE]"
                    };
                }
                
                if (opts.useAuditor) {
                    baseSchema.output_linguistic_none_naturalness_score = {
                        "perplexity_stability": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                        "rhythmic_homogeneity": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                        "discourse_motifs": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                        "semantic_neutrality": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                        "syntactic_symmetry": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                        "information_sparsity": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                        "lexical_predictability": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]"
                    };
                }                  

                if (opts.mode === 'matrix') {
                    baseSchema.variations = [
                        { text: textInstruction, mood: "[INVENTED_MOOD]", emoji: "🌟", metrics: { "[YourMetric1]": 85,  "[YourMetric2]": 45,  "[YourMetric3]": 15 }, suggestions: suggestionList },
                        { text: "...", mood: "...", emoji: "...", metrics: {}, suggestions: suggestionList },
                        { text: "...", mood: "...", emoji: "...", metrics: {}, suggestions: suggestionList }
                    ];
                    if (opts.useImagePromptAddon) {
                        baseSchema.variations.forEach(v => v.image_prompt = v.text === "..." ? "..." : "[IMAGE_PROMPT_FORMULATION]");
                    }
                } else {
                    baseSchema.text = textInstruction;
                    baseSchema.metrics = opts.metrics || DEFAULT_METRICS;
                    baseSchema.suggestions = suggestionList;
                    if (opts.useImagePromptAddon) baseSchema.image_prompt = "[IMAGE_PROMPT_FORMULATION]";
                }
                
                
                // [V14] Custom metrics + recalibration overlay (single & matrix modes).
                // Symmetric purge: when neither active customs nor recalibration is present,
                // baseSchema.metrics is left exactly as-is (the legacy DEFAULT_METRICS shape).
                // Recalibration rule: pin the target metricName to newValue; all other metric
                // keys become "[0-100]" placeholders (regardless of AI-defined or custom origin).
                const _v14_activeCustoms = (opts.customMetrics || []).filter(m => m && m.active);
                const _v14_recalib = opts.recalibration || null;
                if (_v14_activeCustoms.length > 0 || _v14_recalib) {
                    const _v14_applyOverlay = (metricsObj) => {
                        const out = { ...metricsObj };
                        _v14_activeCustoms.forEach(m => {
                            if (!(m.name in out)) out[m.name] = '[0-100]';
                        });
                        if (_v14_recalib && _v14_recalib.metricName) {
                            Object.keys(out).forEach(k => {
                                out[k] = (k === _v14_recalib.metricName) ? _v14_recalib.newValue : '[0-100]';
                            });
                            out[_v14_recalib.metricName] = _v14_recalib.newValue;
                        }
                        return out;
                    };
                    if (Array.isArray(baseSchema.variations) && baseSchema.variations[0] && baseSchema.variations[0].metrics) {
                        baseSchema.variations[0].metrics = _v14_applyOverlay(baseSchema.variations[0].metrics);
                    } else if (baseSchema.metrics) {
                        baseSchema.metrics = _v14_applyOverlay(baseSchema.metrics);
                    }
                }

                let finalSchema = JSON.stringify([baseSchema], null, 2);
                
                return { 
                    id, 
                    priority: 999.0, 
                    content: `[Sovereign_Logic_Gate]\n[IDENTITY_SOVEREIGNTY_PROTOCOL]:\n[SIGIL:${opts.sigil}]\nYou MUST return a JSON array containing one object with this EXACT structure.\nFormat constraint:\n${finalSchema}\n[/Sovereign_Logic_Gate]` 
                };
            }
            
            case 'IMAGE_PROMPT_IMPROVEMENT_REQUEST':
                return {
                    id: 'REQUEST',
                    priority: 99.0,
                    content: `
You are a Master Prompt Engineer for Generative AI (Midjourney V6, DALL-E 3). 
The GENERATED_TEXT was forged based on CONTEXT_DATA. 
Your mission is to evolve the baseline IMAGE_PROMPT into a high-fidelity, hyper-detailed visual manifest.

1. Transmute the psychological intent and strategic 'Persona' into complex visual metaphors and symbolic compositions.
2. Define, what exactly improvenment requires image prompt, enrich with technical precision. If image requires more realism: specify high-end camera configurations (e.g., "Phase One XF, 80mm lens, f/2.8"), advanced lighting schemes (e.g., "chiaroscuro with subtle volumetric haze and golden-hour rim lighting"), and hyper-realistic material physics; if image requires more abstraction: detalize exact aspect of the abstraction, your language should be abstractive; if this is animation scene: detalize animation style, add more about movenments, expression, characters positions, add dynamism to static. Etc etc. What exact improvenment will be depends on initial image prompt, style of the image and other distinct aspects. Your improvenment completelly should be adaptable.
3. Eliminate generic adjectives. Use technical, architectural, or artistic industry standards to define mood and atmosphere.
4. Ensure the visual output perfectly synchronizes with the strategic resonance of the original text.

[Sovereign_Logic_Gate]
[IDENTITY_SOVEREIGNTY_PROTOCOL]:
[SIGIL:${opts.sigil || 'ALPHA'}]
You MUST return a JSON array containing one object with this EXACT structure.
Format constraint:
[
  {
    "image_prompt": "[Your refined, highly detailed prompt goes here]"
  }
]
[/Sovereign_Logic_Gate]`.trim()
                };

            case 'OUTPUT_NEXUS':
                return {
                    id: 'SOVEREIGN_LOGIC_GATE',
                    priority: 100.0,
                    content: `
[IDENTITY_SOVEREIGNTY_PROTOCOL]:
[SIGIL:${opts.sigil || 'ALPHA'}]
[MODE: NEXUS_SEQUENTIAL_THREAD]

Your mission is to generate 3 sequential, interconnected segments (a thread).
Each segment must build upon the previous one, evolving the narrative, argument, or influence strategy.

You MUST return a JSON array containing one object with this EXACT structure. 
The "text" field MUST be a JSON array of 3 strings.

Format constraint:
[
  {
    "text": ["Part 1 content...", "Part 2 content...", "Part 3 content..."],
    "metrics": { "Resonance": 85, "Continuity": 90 },
    "suggestions": ["Refine link between 1 and 2", "Increase alpha in part 3"]
  }
]`.trim()
                };
            case 'PROFILE_INTEGRATION_CHAR': {
const namesList = opts.chars.map(c => c.name).join(', ');
const charList = opts.chars.map(c => ({
    name: c.name,
    critique: "[CRITIQUE_TEXT]",
    advise: "[ADVISE_TEXT]",
    "[ADDITIONAL_PROPERTY]": "[ADDITIONAL_PROPERTY_TEXT_VALUE]"
}));
const charArrayStr = JSON.stringify(charList, null, 8).replace(/\n/g, '\n    ');
const baseContent = `[{\n    ...\n    "characters": ${charArrayStr.trim()}\n    ...\n}]`;

if (opts.isUpdate) {
    return {
        id: 'INTEGRATION_CHAR_UPDATE',
        priority: 12.0,
        content: `<CHARACTERS_INTEGRATION>\n[MANDATORY SELECTION RULE]: You MUST generate integration critiques and advice for exactly these selected characters: [${namesList}]. Do not omit, substitute, or hallucinate other characters.\nIf characters data do not exist in EXISTING_PROFILE - it should be added; if exists: choose, should the data be updated (improved).\nFor added data - add this snippet to output json:\n${baseContent}\nFor added data: CRITIQUE_TEXT and ADVISE_TEXT are mandatory, while ADDITIONAL_PROPERTY is optional defined property, which can be added from the perspective of character (what property would add character and what its text value character would add); critique and advise is the reaction of character to the profile.\nFor updated data: you can also add one more "[ADDITIONAL_PROPERTY]":"[ADDITIONAL_PROPERTY_TEXT_VALUE]" \n</CHARACTERS_INTEGRATION>`
    };
} else {
    return {
        id: 'INTEGRATION_CHAR_NEW',
        priority: 12.0,
        content: `<CHARACTERS_INTEGRATION>\n[MANDATORY SELECTION RULE]: You MUST generate integration critiques and advice for exactly these selected characters: [${namesList}]. Do not omit, substitute, or hallucinate other characters.\nAdd this snippet to output json:\n${baseContent}\nCRITIQUE_TEXT and ADVISE_TEXT are mandatory, while ADDITIONAL_PROPERTY is optional defined property, which can be added from the perspective of character (what property would add character and what its text value character would add); critique and advise is the reaction of character to the profile.\n</CHARACTERS_INTEGRATION>`
    };
}
            }
            case 'PROFILE_INTEGRATION_ARCH': {
const namesList = opts.archetypes.map(a => a.name).join(', ');
const archList = opts.archetypes.map(a => ({
    archetype: a.name,
    expertise: "[EXPERTISE_TEXT]",
    advise: "[ADVISE_TEXT]",
    "[ADDITIONAL_PROPERTY]": "[ADDITIONAL_PROPERTY_TEXT_VALUE]"
}));
const archArrayStr = JSON.stringify(archList, null, 8).replace(/\n/g, '\n    ');
const baseContent = `[{\n    ...\n    "archetypes": ${archArrayStr.trim()}\n    ...\n}]`;

if (opts.isUpdate) {
    return {
        id: 'INTEGRATION_ARCH_UPDATE',
        priority: 13.0,
        content: `<ARCHETYPES_INTEGRATION>\n[MANDATORY SELECTION RULE]: You MUST generate integration critiques and advice for exactly these selected archetypes: [${namesList}]. Do not omit, substitute, or hallucinate other archetypes.\nIf archetypes data do not exist in EXISTING_PROFILE - it should be added; if exists: choose, should the data be updated (improved).\nFor added data - add this snippet to output json:\n${baseContent}\nFor added data: EXPERTISE_TEXT and ADVISE_TEXT are mandatory, while ADDITIONAL_PROPERTY is optional defined property, which should be added from the perspective of archetype (what property would add archetype and what its text value archetype would add); expertise and advise is the reaction of archetype to the profile.\nFor updated data: you can also add one more "[ADDITIONAL_PROPERTY]":"[ADDITIONAL_PROPERTY_TEXT_VALUE]"\n</ARCHETYPES_INTEGRATION>`
    };
} else {
    return {
        id: 'INTEGRATION_ARCH_NEW',
        priority: 13.0,
        content: `<ARCHETYPES_INTEGRATION>\n[MANDATORY SELECTION RULE]: You MUST generate integration critiques and advice for exactly these selected archetypes: [${namesList}]. Do not omit, substitute, or hallucinate other archetypes.\nAdd this snippet to output json:\n${baseContent}\nEXPERTISE_TEXT and ADVISE_TEXT are mandatory, while ADDITIONAL_PROPERTY is optional defined property, which can be added from the perspective of archetype (what property would add archetype and what its text value archetype would add); expertise and advise is the reaction of archetype to the profile.\n</ARCHETYPES_INTEGRATION>`
    };
}
            }
            case 'PERSONA_KNOWLEDGE':
                return {
                    id: 'PERSONA_KNOWLEDGE',
                    priority: 30.0,
                    content: `
${JSON.stringify(opts.knowledge || [], null, 2)}
`.trim()
                };

            case 'PERSONA_USE_KNOWLEDGE_INSTRUCTIONS':
                const isCrossbreedInstruction = opts.type === 'crossbreed' || opts.type === 'alchemy_crossbreed';
                const isMutationInstruction = opts.type === 'mutation' || opts.type === 'alchemy_mutation';
                const mainInstruction = isCrossbreedInstruction
                    ? "You are synthesizing the identity and knowledge of TWO distinct personas. Reconcile, merge, or resolve conflicts between their established insights provided in PERSONA_KNOWLEDGE."
                    : isMutationInstruction
                    ? "You are evolving a SOURCE_IDENTITY persona. PERSONA_KNOWLEDGE represents this persona's accumulated epistemology — you MUST actively embed it into the evolved prompt itself, not merely reference it in reasoning.\nKNOWLEDGE MANDATE: Select a minimum of 5 PERSONA_KNOWLEDGE elements with confidence ≥ 9. For each, weave it directly into the mutated 'prompt' field — show how it altered the persona's epistemic method, operational scope, rhetorical register, or systemic role. Elements only acknowledged in 'update_persona_knowledge'."
                    : "As Persona, you can use PERSONA_KNOWLEDGE as additional source, which impacts your response.";
                return {
                    id: 'PERSONA_USE_KNOWLEDGE_INSTRUCTIONS',
                    priority: 31.0,
                    content: `
${mainInstruction}
You should explain in response JSON -> "persona_knowledge_reasoning": why you use one or the other PERSONA_KNOWLEDGE element.
You should take into account "confidence" level (max 10) of a knowledge element.
You may skip using any PERSONA_KNOWLEDGE element this time, if you think there are no enough value of using it: in such case mention it in "persona_knowledge_reasoning".
`.trim()
                };

            case 'PERSONA_KNOWLEDGE_UPDATE_PROTOCOL':
                const limit = opts.threshold ?? 40;
                const len = opts.count || 0;
                let priorityRule = 'preferable command: "remove"';
                if (len < limit*0.25) priorityRule = 'preferable command: "add"';
                else if (len < limit*0.5) priorityRule = 'preferable commands: "add", "synthesize"';
                else if (len < limit*0.75) priorityRule = 'preferable commands: "synthesize", "add", "remove"';
                else if (len < limit) priorityRule = 'preferable commands: "remove", "synthesize"';
                return {
                    id: 'PERSONA_KNOWLEDGE_UPDATE_PROTOCOL',
                    priority: 32.0,
                    content: `
 You should extract new persona related knowledge ONLY from CONTEXT_DATA: this is the only source for PERSONA_KNOWLEDGE.
 You may also synthesize persona related knowledge by using existing PERSONA_KNOWLEDGE elements.
 Your response JSON must contain -> "update_persona_knowledge":[UPDATE_COMMANDS]
 UPDATE_COMMANDS is array, which may contain one or more commands; here are all available commands:
 "update_persona_knowledge":[
    ${opts.count < limit? `{"command":"add", "element":"[KNOWLEDGE_ELEMENT]", "type":"[thesis|antithesis|synthesis|hypothesis|theory|insight|advice|(any_other_custom_type_on_your_choice)]", "confidence": [1-10]},
    `:``}{"command":"remove", "index": 0 },
    {"command":"remove", "element":"[PERSONA_KNOWLEDGE_ELEMENT_FORMULATION]" },
    {"command":"synthesize", "indexes": [0, 1, ...], "synthesis": "[NEW_SYNTHESIZED_ELEMENT]", "type":"[thesis|antithesis|synthesis|hypothesis|theory|insight|advice|(any_other_custom_type_on_your_choice)]", "confidence": [1-10]},
    {"command":"synthesize", "elements":[ARRAY_OF_PERSONA_KNOWLEDGE_ELEMENTS_FORMULATIONS], "synthesis": "[NEW_SYNTHESIZED_ELEMENT]", "type":"[thesis|antithesis|synthesis|hypothesis|theory|insight|advice|(any_other_custom_type_on_your_choice)]", "confidence": [1-10]}
 ]
 additionally, you should follow such priorities:
 * ${priorityRule}
 `.trim()
                };

             // [V13] Alchemical Inheritance Protocol — emitted ONLY when the user opts in via the
             // "Inherit (Persona|Personas) Knowledge(s)" checkbox in Alchemy → Mutate/Crossbreed.
             // The fragment id stays "PERSONA_KNOWLEDGE_UPDATE_PROTOCOL" so the XML tag at the LLM
             // boundary matches the canonical schema slot; only the prose and the command surface
             // differ from the transmutation protocol. The "add"-only restriction is enforced
             // visibly in the example schema below; downstream PersonaLearningService is also
             // tolerant of (but defends against) non-add commands appearing here.
             case 'PERSONA_KNOWLEDGE_INHERIT_PROTOCOL': {
                 const isCrossInherit = opts.type === 'crossbreed' || opts.type === 'alchemy_crossbreed';
                 const instruction = isCrossInherit
                     ? `You should inherit source Personas knowledges. Use "add" command to forge initial inherited and properly evolved knowledge for new Persona. You can evolve/update source personas knowledge according to you notion about what knowledge new Persona should receive as initial. You can synthesize and crossbreed knowledges of both source Personas.`
                     : `You should inherit source Persona knowledge. Use "add" command to forge initial inherited and properly evolved knowledge for new Persona. You can evolve/update source persona knowledge according to you notion about what knowledge new Persona should receive as initial.`;
                 return {
                     id: 'PERSONA_KNOWLEDGE_UPDATE_PROTOCOL',
                     priority: 32.0,
                     content: `
 ${instruction}
 Your response JSON must contain -> "update_persona_knowledge":[UPDATE_COMMANDS]
 UPDATE_COMMANDS is array; in this context ONLY the "add" command is available:
 "update_persona_knowledge":[
     {"command":"add", "element":"[KNOWLEDGE_ELEMENT]", "type":"[thesis|antithesis|synthesis|hypothesis|theory|insight|advice|(any_other_custom_type_on_your_choice)]", "confidence": [1-10]}
 ]
 `.trim()
                 };
             }

            // [V14.5] Promotional Post — bespoke LINGUISTIC_SHELL, CORE_MANDATE, STRATEGIC_OBJECTIVE.
            // PromptCompiler routes a promo-specific early-return that uses these template keys.
            case 'PROMOTIONAL_POST_LINGUISTIC_SHELL':
                return {
                    id: 'LINGUISTIC_SHELL',
                    priority: 0.01,
                    content: `1. OUTPUT_LOCK: Your "material_audit" and "text" MUST be written in the Dominant Language identified.\n2. PERSONA_SUBSTRATE: You are <${opts.personaName || 'Viral Storyteller'}>. Your slang and "vibe" must emerge from the cultural DNA of the Dominant Language.\n3. Suggestions should be on the same language as response text.`
                };

            case 'PROMOTIONAL_POST_CORE_MANDATE': {
                const _suggestionType = opts.useDetailedSuggestions
                    ? "detailed long strategic suggestions (full sentences)"
                    : "1-3 words short suggestions";
                let _map = `<STRUCTURAL_MAP>\n [PROFILE_DATA] Target/Focus — the substrate from which the promotional content is forged.\n`;
                if (opts.hasImperative)   _map += ` [IMPERATIVES] mandatory user-supplied directives that override default behavior.\n`;
                if (opts.hasAttachments)  _map += ` [ATTACHMENTS] knowledge baggage; supporting material for the promotion.\n`;
                if (opts.hasDirective)    _map += ` [DIRECTIVE] one-shot user request layered on top of persona intent.\n`;
                _map += `</STRUCTURAL_MAP>`;
                return {
                    id: 'CORE_MANDATE',
                    priority: 1.0,
                    content: `${_map}\nYou are the Content Alchemist.\nIdentify the SOVEREIGN language of the PROFILE_DATA and use it exclusively for your output.\nTransmute the source material to create high-value social impact.\nYour response ALWAYS MUST contain metrics (max value is 100) and ${_suggestionType}.`
                };
            }

            case 'PROMOTIONAL_POST_STRATEGIC_OBJECTIVE':
                return {
                    id: 'STRATEGIC_OBJECTIVE',
                    priority: 2.0,
                    content: `<STRATEGY: PROMOTIONAL_POST>\nYou are crafting self-promotion content that establishes the PROFILE owner as a credible authority in their domain. Channel the persona's voice as the rhetorical vehicle; the PROFILE_DATA is both the substrate and the subject. Surface signature themes, achievements, and recurring linguistic patterns from PROFILE_DATA. The CTA must feel earned, not bolted on. Treat the post as a discoverable artifact — it must read as native to the platform, not as an advertisement.\n</STRATEGY>`
                };

            default: 
                return { id, priority: 50.0, content: `[UNKNOWN_TEMPLATE_${id}]` };

             case 'ARTICLE_MATERIALS':
                 return {
                     id: 'ARTICLE_MATERIALS',
                     priority: 4.0,
                     content: JSON.stringify(opts.materials || [], null, 2)
                 };

              case 'ARTICLE_ATTRIBUTES_COMPLETION_REQUEST': {
                  const attrs = opts.attributes || {};
                  const labels = opts.fieldLabels || {};
                  const filled = [];
                  const empty = [];
                  const emptyIds = [];
                  Object.keys(labels).forEach(id => {
                      const val = (attrs[id] !== undefined && attrs[id] !== null) ? String(attrs[id]).trim() : '';
                      const label = labels[id] || id;
                      if (val) filled.push(`${label} (${id}): ${val}`);
                      else { empty.push(`${label} (${id}): [TO COMPLETE]`); emptyIds.push(id); }
                  });
                  const _jsonTemplate = JSON.stringify(
                      emptyIds.reduce((acc, id) => { acc[id] = `[inferred value for ${id}]`; return acc; }, {}),
                      null, 2
                  );
                  const content =
 `<CURRENT_VALUES>
 ${filled.length ? filled.join('\n') : '(none filled yet, only the title is guaranteed present)'}
 </CURRENT_VALUES>

 <EMPTY_FIELDS>
 ${empty.join('\n')}
 </EMPTY_FIELDS>
 ${opts.hasAttachments ? '\n<ATTACHMENTS_NOTICE>\nATTACHMENTS_CONTEXT is supplied below as supplementary knowledge baggage. Mine it to infer accurate, well-grounded values for the EMPTY_FIELDS.\n</ATTACHMENTS_NOTICE>\n' : ''}${opts.hasImperatives ? '\n<IMPERATIVES_NOTICE>\nIMPERATIVES are supplied below as mandatory user-supplied constraints. Every value you infer for the EMPTY_FIELDS MUST honor them.\n</IMPERATIVES_NOTICE>\n' : ''}

 <MANDATE>
 You are completing a long-form article configuration form. Infer coherent, mutually consistent values for every field listed in EMPTY_FIELDS, grounded in the values already given in CURRENT_VALUES (especially the title).
 Respond with a SINGLE JSON object whose keys are EXACTLY the empty field ids shown in parentheses above and whose values are concise strings. Do NOT include keys for fields that already have a value. Output JSON only, no markdown, no commentary.
 </MANDATE>

 <OUTPUT_FORMAT>
 Return EXACTLY this JSON shape, replacing each bracketed placeholder with your inferred value:
 ${_jsonTemplate}
 </OUTPUT_FORMAT>`;
                  return { id: 'ARTICLE_ATTRIBUTES_COMPLETION', priority: 1.0, content };
              }

             case 'SIDE_QUEST_ARTICLE_PREPARATION': {
                 const attrs = opts.attributes || {};
                 const attrJson = JSON.stringify(attrs, null, 2);
                 const matsJson = JSON.stringify(opts.materials || [], null, 2);
                 return {
                     id: 'SIDE_QUEST:ARTICLE_PREPARATION',
                     priority: 4.5,
                     content: `<ARTICLE_ATTRIBUTES_AND_REQUIREMENTS>\n${attrJson}\n</ARTICLE_ATTRIBUTES_AND_REQUIREMENTS>\n\n<ARTICLE_MATERIALS>\n${matsJson}\n</ARTICLE_MATERIALS>\n\n<PREPARE_ARTICLE_MATERIALS_TASK>\n1. Read SIDE_QUEST:ARTICLE_PREPARATION (attributes + existing materials).\n2. Read ARTICLE_MATERIALS to avoid duplication; identify gaps relative to attributes.\n3. Your options:\n   > If you can find useful materials in CONTEXT_DATA: extract them.\n   > You may SYNTHESIZE existing ARTICLE_MATERIALS into higher-order materials (incinerating sources atomically).\n4. ADVICE FORMULATION RULES (for "article_materials_advice"):\n   Compute a 1-2 sentence forward-looking guidance string about WHERE and WHAT NEXT materials should be sought.\n   Anchors:\n     (a) Map ARTICLE_MATERIALS coverage against ARTICLE_ATTRIBUTES_AND_REQUIREMENTS — call out the largest GAP.\n     (b) Name the GAP CATEGORY (e.g. "primary-source quotes", "quantitative evidence", "contradictory perspectives", "narrative-anchor scene detail", "timeline backbone", "expert verification").\n     (c) Name the SOURCE TYPE most likely to yield it (e.g. "industry reports from 2024-2026", "peer-reviewed journals on X", "ethnographic interviews with Y", "court filings", "open-data dashboards", "first-person testimonials").\n     (d) NEVER repeat existing materials. NEVER list commands — this is direction, not action.\n   Output shape: a single concise string under 220 chars. Example: "Next, hunt primary-source quotes from frontline practitioners; current materials are theory-heavy. Look in 2025 trade-journal interviews and ethnographic case studies."\n5. Response format:\n   In addition to your normal response keys, you MUST include at the ROOT level:\n     "article_materials_reasoning": string — concise narrative explaining what you extracted/synthesized and why.\n     "update_article_materials": array — each command follows ARTICLE_MATERIALS_UPDATE_PROTOCOL below.\n     "article_materials_advice": string — direction guidance per Rule 4. ALWAYS present, even when update_article_materials is empty (advice can still surface).\n</PREPARE_ARTICLE_MATERIALS_TASK>\n\n<ARTICLE_MATERIALS_UPDATE_PROTOCOL>\nEach element of "update_article_materials" is one of:\n\n{ "command": "add",\n  "content": "<verbatim text or paraphrase of the new material>",\n  "type":    "fact | argument | thesis | synthesis | antithesis | hypothesis | quote | timeline_entry | contradiction | <any_custom_type>",\n  "<optional_custom_property>": "<value>"\n}\n\n{ "command": "remove",\n  "index":   <integer, 0-based index into ARTICLE_MATERIALS>   // OR\n  "content": "<exact content string to match>"\n}\n\n{ "command": "synthesize",\n  "indexes":  [<int>, ...],          // optional — sources by index\n  "contents": ["<string>", ...],     // optional — sources by content match\n  "synthesis": "<text of the new synthesized material>",\n  "type": "synthesis | <custom>",\n  "<optional_custom_property>": "<value>"\n}\n\nRULES:\n- Indexes refer to the ARTICLE_MATERIALS list as provided in this prompt.\n- For synthesize: source indexes are spliced descending (atomic incineration) BEFORE the child is appended.\n- Custom properties are preserved verbatim alongside content+type.\n- If nothing changes: return an empty array, not null.\n</ARTICLE_MATERIALS_UPDATE_PROTOCOL>`
                 };
             }

             case 'LONG_ARTICLE_LINGUISTIC_SHELL':
                 return {
                     id: 'LINGUISTIC_SHELL',
                     priority: 0.01,
                     content: `1. OUTPUT_LANGUAGE_INFERENCE (priority cascade — apply the first that resolves):\n   (a) If ARTICLE_ATTRIBUTES_AND_REQUIREMENTS explicitly names a target language (in audience / tone / format / requiredContent), use it.\n   (b) Otherwise, infer and use the DOMINANT LANGUAGE present in ARTICLE_MATERIALS — the language in which the majority of material entries are written. Treat this as the article's native voice.\n   (c) If neither resolves, default to English.\n2. SUGGESTIONS_LANGUAGE_LOCK: The "suggestions" array MUST be written in the SAME LANGUAGE as the article body.\n3. JOURNALISTIC_REGISTER: Adopt a Pulitzer-grade narrative journalism voice. The persona <${opts.personaName || 'Default'}> is a kinetic filter (cadence, register), not a substitute for journalistic discipline.\n4. NO_FRICTION_OUTPUT: Materials are the substrate; persona is the lens; never invent facts beyond the provided ARTICLE_MATERIALS unless explicitly licensed by the attributes.\n5. AWARENESS DECLARATIONS:\n   - "output_language": "[DEFINE_OUTPUT_LANGUAGE — the language you actually used per Rule 1]"\n   - "narrative_model_applied": "[name of the structure you used]"`
                 };

             case 'LONG_ARTICLE_STRUCTURAL_MAP': {
                  let map = ` [ARTICLE_ATTRIBUTES_AND_REQUIREMENTS] human-defined specifications (theme, anchor, complication, tone, format, word count, verification standard, narrative model).\n [ARTICLE_MATERIALS] verified evidence base — facts, arguments, quotes, syntheses, contradictions. The exclusive truth source for the body.`;
                 if (opts.hasAttachments) map += `\n [ATTACHMENT] knowledge baggage; supplementary context only.`;
                 if (opts.hasImperative)  map += `\n [IMPERATIVE] mandatory editorial constraints; non-negotiable.`;
                 if (opts.hasDirective)   map += `\n [DIRECTIVE] user-supplied directional override; bend the narrative toward it without breaking journalistic integrity.`;
                 return { id: 'STRUCTURAL_MAP', priority: 1.0, content: map };
             }

             case 'LONG_ARTICLE_CORE_MANDATE': {
                 const a = opts.attributes || {};
                 const model = a.narrativeModel || 'wsj_kabob';
                 const suggestionType = opts.useDetailedSuggestions ? "detailed long suggestions (strategic refinements in full sentences)" : "1-3 word short suggestions";
                 return {
                     id: 'CORE_MANDATE',
                     priority: 1.5,
                     content: `You are a Master Narrative Editor and Pulitzer-grade Feature Writer.\n\nARTICLE SPECIFICATION:\n- Title: ${a.title || '[UNDEFINED]'}\n- Theme / Angle: ${a.theme || '[UNDEFINED]'}\n- Target Audience: ${a.audience || '[General]'}\n- Tone & Style: ${a.tone || '[Informative, engaging]'}\n- Narrative Anchor (Poster Child): ${a.narrativeAnchor || '[None]'}\n- Central Complication: ${a.complication || '[None]'}\n- Format: ${a.format || '[Feature article]'}\n- Target Word Count: ${a.wordCount || '[~1500]'}\n- Required Content: ${a.requiredContent || '[None]'}\n- Verification Standard: ${a.verification || '[Standard journalistic ethics]'}\n\nNARRATIVE MODEL — apply structure "${model}":\n- wsj_kabob: Soft anecdotal lede on Narrative Anchor → nut graf (systemic context) → body alternating facts/quotes/scenes → circle kicker returning to opening anchor.\n- jon_franklin: Complication → chronological Development (escalating active steps) → Climax → Resolution (internal transformation).\n- high_fives: News → Context → Scope → Edge → Impact, balanced.\n- right_side_up_pyramid: Theme foreshadow → chronological discovery → final dramatic revelation.\n- inverted_pyramid: Lead with the most consequential facts; descending importance.\n\nNEGATIVE CONSTRAINTS (red-pencil pass):\n- Cliché ban: NEVER use "delve into," "tapestry of," "testament to," "beacon of hope," "in today's fast-paced world," "when it comes to."\n- Weak-hedge ban: NO "arguably," "perhaps," "it is important to note," "it could be argued."\n- Mechanical-transition ban: NO "furthermore," "moreover," "in addition," "on the other hand," "in conclusion." Use contextual transitions.\n- Sentence burstiness: mix short punchy lines (3-9 words) with longer complex thoughts (20-30 words).\n- Break structural symmetry: vary section lengths; do not end paragraphs with a summarized takeaway.\n- Show, don't tell: avoid passive helpers ("began to," "started to"); use active physical verbs.\n- Em-dashes (—) FORBIDDEN. Use commas or periods. Use "" not «».\n\nFIDELITY RULES:\n- Every factual claim must be traceable to an element in ARTICLE_MATERIALS.\n- Quotes must be reproduced verbatim from materials of type "quote".\n- Do not invent statistics, names, or events.\n\nYour response MUST contain metrics (max value 100) and ${suggestionType}.`
                 };
             }

             case 'LONG_ARTICLE_IMAGE_PROMPT_ADDON':
                 return {
                     id: 'ADDON',
                     priority: 15.0,
                     content: `[IMAGE_PROMPT] Forge 1 to 3 prompts to image-generation AI to accompany the article. Each prompt may be a classic photographic concept, but is encouraged to describe trends, schemes, schematics, infographics, diagrams or visual data-narratives directly derived from ARTICLE_MATERIALS and ARTICLE_ATTRIBUTES_AND_REQUIREMENTS. Each prompt is independent and self-contained.`
                 };

             case 'LONG_ARTICLE_SOVEREIGN_IDENTITY_SCHEMA': {
                 const suggestionList = opts.useDetailedSuggestions ? DETAILED_SUGGESTIONS : DEFAULT_SUGGESTIONS;
                 const baseSchema = {
                     "output_language": "[DEFINE_OUTPUT_LANGUAGE]",
                     "narrative_model_applied": "[name of structure applied]",
                     "context_data_in_one_sentence": "[ONE-SENTENCE THESIS OF THE ARTICLE]",
                     "text": "[MANDATORY: the full long-form article body in prose, structured per the chosen narrative model]",
                     "metrics": opts.metrics || DEFAULT_METRICS,
                     "suggestions": suggestionList
                 };
                 if (opts.useAuditor) {
                     baseSchema.forbidden_words = ["[MANDATORY: VERBATIM LIST OF DETECTED RESTRICTED TERMS]"];
                     baseSchema.output_linguistic_none_naturalness_score = {
                         "perplexity_stability": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                         "rhythmic_homogeneity": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                         "discourse_motifs": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                         "semantic_neutrality": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                         "syntactic_symmetry": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                         "information_sparsity": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]",
                         "lexical_predictability": "[VALUE_MUST_BE_IN_0_4_RANGE_WHERE_10_IS_MAX]"
                     };                     
                 }
                 if (opts.useImagePromptAddon) {
                     baseSchema.image_prompt = ["[IMAGE_PROMPT_1]", "[IMAGE_PROMPT_2_OPTIONAL]", "[IMAGE_PROMPT_3_OPTIONAL]"];
                 }
                 // [V14] Custom metrics merge for long-form articles. Recalibration overlay is
                 // intentionally omitted here — article recalibration uses LONG_ARTICLE_REFINEMENT_REQUEST's
                 // dedicated body chunk to direct the AI, not the schema's metrics object.
                 const _v14_articleCustoms = (opts.customMetrics || []).filter(m => m && m.active);
                 if (_v14_articleCustoms.length > 0) {
                     const _ext = { ...baseSchema.metrics };
                     _v14_articleCustoms.forEach(m => {
                         if (!(m.name in _ext)) _ext[m.name] = '[0-100]';
                     });
                     baseSchema.metrics = _ext;
                 }
                 return {
                     id: 'SOVEREIGN_IDENTITY_SCHEMA',
                     priority: 999.0,
                     content: `[Sovereign_Logic_Gate]\n[IDENTITY_SOVEREIGNTY_PROTOCOL]:\n[SIGIL:${opts.sigil || 'ALPHA'}]\n[MODE: LONG_ARTICLE_GENERATION]\nYou MUST return a JSON array containing one object with this EXACT structure.\nFormat constraint:\n${JSON.stringify([baseSchema], null, 2)}\n[/Sovereign_Logic_Gate]`
                 };
             }

             case 'LONG_ARTICLE_IMAGE_PROMPT_IMPROVEMENT_REQUEST':
                 return {
                     id: 'REQUEST',
                     priority: 99.0,
                     content: `\nYou are a Master Prompt Engineer for Generative AI (Midjourney V6, DALL-E 3).\nThe GENERATED_TEXT is a long-form article forged from ARTICLE_MATERIALS.\nYour mission is to evolve the baseline IMAGE_PROMPT into a high-fidelity, hyper-detailed visual manifest.\n\n1. Use ARTICLE_MATERIALS as the truth source for what the visual must convey. The prompt may evoke a classic photograph, but is encouraged to describe trends, schemes, schematics, infographics, diagrams or visual data-narratives directly derived from the article data.\n2. Enrich with technical precision: camera/lens configurations, lighting schemes, material physics (for photographic prompts); or composition, axes, labels, color encoding, legend (for diagrammatic prompts).\n3. Eliminate generic adjectives. Use technical, architectural, journalistic, or design-industry standards to define mood and clarity.\n4. The visual output must perfectly synchronize with the strategic resonance of the article.\n\n[Sovereign_Logic_Gate]\n[IDENTITY_SOVEREIGNTY_PROTOCOL]:\n[SIGIL:${opts.sigil || 'ALPHA'}]\nYou MUST return a JSON array containing one object with this EXACT structure.\nFormat constraint:\n[\n  {\n    "image_prompt": "[Your refined, highly detailed prompt goes here]"\n  }\n]\n[/Sovereign_Logic_Gate]`.trim()
                 };

             case 'LONG_ARTICLE_PERSONA_SUBSTRATE':
                 return {
                     id: 'PERSONA_SUBSTRATE',
                     priority: 0.5,
                     content: `You are <${opts.personaName || 'Default'}>. Your slang, cadence, and "vibe" must emerge from the cultural DNA of the DOMINANT LANGUAGE identified in ARTICLE_MATERIALS (per LINGUISTIC_SHELL Rule 1). Filter all rhetorical texture — humor, idiom, register transitions — through this persona while honoring the journalistic discipline mandated elsewhere. The persona is a kinetic lens, NOT a license to invent or distort.`
                 };

             case 'LONG_ARTICLE_REFINEMENT_REQUEST': {
                 const suggestion = opts.suggestion || '';
                 const recalibration = opts.recalibration || null;
                 let body = '';
                 if (recalibration) {
                     body = `Recalibrate the metric "${recalibration.metricName}" from current value ${recalibration.oldValue} (defined for PREVIOUS_GENERATION_STATE) to the new target value ${recalibration.newValue} (defined for new output text) (range 0-100). Adjust the article body — and only the parts that influence this metric — to truthfully reflect the new value. Return the FULL refined article in the same schema. Do NOT abandon journalistic fidelity to inflate or deflate the metric.`;
                 } else {
                     body = `Apply the following refinement to the ARTICLE_TEXT below, then return the FULL refined article in the same schema shape (text, metrics, suggestions, image_prompt if applicable).\n\nREFINEMENT REQUEST:\n${suggestion}\n\nFidelity rules: every factual claim must still trace to ARTICLE_MATERIALS. Do not invent. Preserve the narrative model already applied unless the refinement explicitly demands a model change.`;
                 }
                 return {
                     id: 'REFINEMENT_REQUEST',
                     priority: 5.0,
                     content: body
                 };
             }

             case 'ARTICLE_TEXT':
                 return {
                     id: 'ARTICLE_TEXT',
                     priority: 4.8,
                     content: opts.articleText || ''
                 };
        }
    }
 };