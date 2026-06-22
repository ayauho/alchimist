/**
 * @file services/PromptCompiler.js
 * @purpose Priority-Driven Aggregator for Linguistic Sieges.
 */
import { PromptTemplates } from '../utils/promptTemplates.js';
import { State } from './State.js';
import { log } from '../utils/logger.js';
import { Language } from './Language.js';

export const PromptCompiler = {
    compile(input) {
        let { context = {}, persona = {}, config = {}, tags = null, refinement = null, recalibration = null, attachments = [] } = input;

        // [V17] Article Attribute Auto-Completion — earliest early-return branch.
        // No persona/context siege: a single self-contained fragment asking the model to
        // saturate the empty fields of the Create/Edit Article form as a JSON object.
        if (input.type === 'article_attributes_completion') {
            const _acImperatives = Array.isArray(input.imperatives) ? input.imperatives.filter(i => i && i.active) : [];
            const _acAttachments = Array.isArray(input.attachments) ? input.attachments.filter(a => a && a.used) : [];
            const _frag = PromptTemplates.get('ARTICLE_ATTRIBUTES_COMPLETION_REQUEST', {
                attributes: input.attributes || {},
                fieldLabels: input.fieldLabels || {},
                hasImperatives: _acImperatives.length > 0,
                hasAttachments: _acAttachments.length > 0
            });
            // [V17] ARTICLE_ATTRIBUTES_COMPLETION must be the FINAL fragment so the AI reads the
            // attachments/imperatives substrate first, then the request + output schema last.
            const _acParts = [];
            if (_acAttachments.length > 0) {
                let _acAttBlock = '';
                _acAttachments.forEach(att => { _acAttBlock += `<ATTACHMENT name="${att.name}">\n${att.content}\n</ATTACHMENT>\n`; });
                _acParts.push(`<ATTACHMENTS_CONTEXT>\n${_acAttBlock.trim()}\n</ATTACHMENTS_CONTEXT>`);
            }
            const _acImpFrag = PromptTemplates.get('IMPERATIVES', { imperatives: _acImperatives });
            if (_acImpFrag) _acParts.push(`<${_acImpFrag.id}>\n${_acImpFrag.content}\n</${_acImpFrag.id}>`);
            _acParts.push(`<${_frag.id}>\n${_frag.content}\n</${_frag.id}>`);
            log('AI', 'ARTICLE_COMPLETION_BRANCH_COMPILED', {
                empty: Object.keys(input.fieldLabels || {}).length,
                imperatives: _acImperatives.length,
                attachments: _acAttachments.length
            });
            return _acParts.join('\n\n');
        }

        // [V13.S³] Nexus Structural Preservation
        // Convert array-based records to JSON so the LLM respects segment boundaries during refinement.
        if (Array.isArray(recalibration)) {
            recalibration = JSON.stringify(recalibration, null, 2);
        }
        if (refinement && Array.isArray(refinement.originalText)) {
            refinement.originalText = JSON.stringify(refinement.originalText, null, 2);
        }

        // Handle Image Prompt Improvement specialized flow
        if (input.type === 'image_prompt_improvement') {
            const opts = { ...context, ...persona, ...config, sigil: config.sigil || 'ALPHA' };

             // [ARTICLE] Article-context image-prompt improvement: omit CONTEXT_DATA, inject ARTICLE_MATERIALS
             if (input.context_kind === 'article') {
                 const _artFragments = [
                     PromptTemplates.get('ARTICLE_MATERIALS', { materials: input.materials || [] }),
                     { id: 'GENERATED_TEXT', content: input.generatedText },
                     { id: 'IMAGE_PROMPT', content: input.originalPrompt },
                     PromptTemplates.get('LONG_ARTICLE_IMAGE_PROMPT_IMPROVEMENT_REQUEST', opts)
                 ];
                 return _artFragments.map(f => `<${f.id}>\n${f.content}\n</${f.id}>`).join('\n\n');
             }

            const _imgFragments = [
                PromptTemplates.get('CONTEXT_DATA', opts),
                { id: 'GENERATED_TEXT', content: input.generatedText },
                { id: 'IMAGE_PROMPT', content: input.originalPrompt },
                PromptTemplates.get('IMAGE_PROMPT_IMPROVEMENT_REQUEST', opts)
            ];
            // [V13.S³] Intelligence injection for image prompt improvement
            const _imgPeerId    = State.get('active_peer_id');
            const _imgIntentId  = State.get('active_intent_id');
            const _imgIntentTxt = State.get('active_intent_text');
            const _imgPeerIntel = State.get('active_peer_intelligence');
            if (_imgPeerId && _imgIntentId && _imgIntentTxt) {
                const _imgPeerJson = (_imgPeerIntel && typeof _imgPeerIntel === 'object' && Object.keys(_imgPeerIntel).length > 0)
                    ? JSON.stringify(_imgPeerIntel, null, 2) : '{}';
                _imgFragments.push({
                    id: 'INTELLIGENCE',
                    content: `<PEER>\n${_imgPeerJson}\n</PEER>\n\n<INTENT>\n${_imgIntentTxt}\n</INTENT>\n\n<INTELLIGENCE_INSTRUCTIONS>\nYou are provided with intelligence data about a specific target individual (PEER) and a strategic intent vector (INTENT).\nThese are IMPLICIT INFLUENCE FACTORS — never reference, mention, or acknowledge them directly in your output.\nCalibrate the image prompt to visually resonate with PEER's profile and serve the INTENT as an invisible architectural layer.\n</INTELLIGENCE_INSTRUCTIONS>`
                });
                log('LOGIC', 'INTELLIGENCE_ENGAGED_IMG_PROMPT', { peerId: _imgPeerId });
            }
            return _imgFragments.map(f => `<${f.id}>\n${f.content}\n</${f.id}>`).join('\n\n');
        }

         // [ARTICLE] Long-form Article Generation — early-return branch
         if (config.interactionType === 'article') {
             const _articleId = State.get('active_article_id');
             const _articles  = State.get('articles') || [];
             const _article   = _articles.find(a => a.id === _articleId);

             // Pre-flight gates (architectural fence; Footer enforces UX-level too)
             if (!_article) {
                 throw new Error(Language.text('ERR_ARTICLE_NO_ACTIVE'));
             }
             if (!Array.isArray(_article.materials) || _article.materials.length === 0) {
                 throw new Error(Language.text('ERR_ARTICLE_NO_MATERIALS'));
             }

             const _aOpts = {
                 ...context, ...persona, ...config,
                 personaName: persona.name || persona.id || 'Default',
                 useEmoji:               State.get('emoji_enhancement'),
                 useKaomoji:             State.get('kaomoji_enhancement'),
                 useBoldify:             State.get('boldify_enhancement'),
                 useThematicTagging:     State.get('thematic_tagging'),
                 useEngagementKinetics:  State.get('engagement_kinetics'),
                 useDetailedSuggestions: State.get('detailed_suggestions'),
                 useVoidSourceAuditor:   config.voidSourceAuditor || State.get('void_source_auditor'),
                 useImagePromptAddon:    config.image_prompt_addon || State.get('image_prompt_addon'),
                 sigil: config.sigil || 'ALPHA',
                 attributes: _article.attributes
             };

             const _aImperatives = Array.isArray(config.imperatives) ? config.imperatives : [];
             const _hasImperative = _aImperatives.some(i => i && i.active);
             const _hasDirective  = !!(config.directive && config.directive.trim());
             const _hasAttachments = Array.isArray(attachments) && attachments.length > 0;
             const _isRefinement   = !!(refinement && (refinement.suggestion || refinement.targetText));
             const _isRecalibrate  = !!recalibration;

             const _aFrags = [];
             _aFrags.push(PromptTemplates.get('LONG_ARTICLE_LINGUISTIC_SHELL', _aOpts));
             _aFrags.push(PromptTemplates.get('LONG_ARTICLE_PERSONA_SUBSTRATE', _aOpts));
             if (persona && persona.prompt) {
                 _aFrags.push({ id: 'PERSONA_PROFILE', priority: 0.7, content: String(persona.prompt) });
             }
             _aFrags.push(PromptTemplates.get('LONG_ARTICLE_STRUCTURAL_MAP', {
                 hasAttachments: _hasAttachments,
                 hasImperative:  _hasImperative,
                 hasDirective:   _hasDirective
             }));
             _aFrags.push(PromptTemplates.get('LONG_ARTICLE_CORE_MANDATE', _aOpts));
             _aFrags.push(PromptTemplates.get('ARTICLE_MATERIALS', { materials: _article.materials }));

             // [REFINEMENT] inject prior article body + refinement directive when this is a refinement/recalibration call
             if (_isRefinement || _isRecalibrate) {
                 const _articleText = (refinement && refinement.targetText) ? String(refinement.targetText) : '';
                 if (_articleText) {
                     _aFrags.push(PromptTemplates.get('ARTICLE_TEXT', { articleText: _articleText }));
                 }
                 _aFrags.push(PromptTemplates.get('LONG_ARTICLE_REFINEMENT_REQUEST', {
                     suggestion: refinement && refinement.suggestion,
                     recalibration: _isRecalibrate ? (typeof recalibration === 'string' ? JSON.parse(recalibration) : recalibration) : null
                 }));
                 log('LOGIC', 'ARTICLE_REFINEMENT_INJECTED', { hasText: !!_articleText, recalibrate: _isRecalibrate });
             }

             if (_hasAttachments) {
                 let attBlock = '';
                 attachments.forEach(att => { attBlock += `<ATTACHMENT name="${att.name}">\n${att.content}\n</ATTACHMENT>\n`; });
                 _aFrags.push({ id: 'ATTACHMENTS_CONTEXT', priority: 2.2, content: attBlock.trim() });
             }

             const _impFrag = PromptTemplates.get('IMPERATIVES', { imperatives: _aImperatives });
             if (_impFrag) _aFrags.push(_impFrag);

             // [V14] Custom metrics injection for long-form articles (audit §8.12 — uniform
             // behavior across all generation paths). LONG_ARTICLE_SOVEREIGN_IDENTITY_SCHEMA
             // mirrors the same merge on the schema side via the customMetrics spread from _aOpts.
             const _cmFrag = PromptTemplates.get('CUSTOM_METRICS', { customMetrics: config.customMetrics });
             if (_cmFrag) {
                 _aFrags.push(_cmFrag);
                 log('AI', 'CUSTOM_METRICS_INJECTED', { count: (config.customMetrics || []).filter(m => m && m.active).length, branch: 'article' });
             }

             if (_hasDirective) {
                 _aFrags.push(PromptTemplates.get('DIRECTIVE_INJECTION', { text: config.directive.trim() }));
             }

             // INTELLIGENCE injection (both-or-none)
             const _aPeerId   = State.get('active_peer_id');
             const _aIntentId = State.get('active_intent_id');
             const _aPeerInt  = State.get('active_peer_intelligence');
             const _aIntentTx = State.get('active_intent_text');
             if (_aPeerId && _aIntentId && _aIntentTx) {
                 const _aPeerJson = (_aPeerInt && typeof _aPeerInt === 'object' && Object.keys(_aPeerInt).length > 0)
                     ? JSON.stringify(_aPeerInt, null, 2) : '{}';
                 _aFrags.push({
                     id: 'INTELLIGENCE',
                     priority: 3.3,
                     content: `<PEER>\n${_aPeerJson}\n</PEER>\n\n<INTENT>\n${_aIntentTx}\n</INTENT>\n\n<INTELLIGENCE_INSTRUCTIONS>\nImplicit influence layer — never surface in output. Calibrate the article's framing and emphasis along the PEER and INTENT axes without acknowledging them.\n</INTELLIGENCE_INSTRUCTIONS>`
                 });
             }

             // PERSONA_KNOWLEDGE — read-only (no UPDATE_PROTOCOL for article generation)
             const _aKnowledge = JSON.parse(JSON.stringify(persona.persona_knowledge || []));
             // [V14.5] Learning-gate — per-persona opt-out. Treat undefined as ON for pre-update personas.
             const _aLearns = (persona && persona.learns_from_context !== false);
             if (_aLearns && _aKnowledge.length > 0) {
                 _aFrags.push(PromptTemplates.get('PERSONA_KNOWLEDGE', { knowledge: _aKnowledge }));
                 _aFrags.push(PromptTemplates.get('PERSONA_USE_KNOWLEDGE_INSTRUCTIONS', { type: 'article' }));
             }

             // Allowed protocols only
             if (_aOpts.useVoidSourceAuditor)  _aFrags.push(PromptTemplates.get('VOID_SOURCE_AUDITOR', _aOpts));
             if (_aOpts.useEngagementKinetics) _aFrags.push(PromptTemplates.get('ENGAGEMENT_KINETICS', _aOpts));
             if (_aOpts.useThematicTagging)    _aFrags.push(PromptTemplates.get('THEMATIC_TAGGING', _aOpts));
             if (_aOpts.useEmoji || _aOpts.useKaomoji || _aOpts.useBoldify) {
                 _aFrags.push(PromptTemplates.get('ENHANCEMENT', _aOpts));
             }
             if (_aOpts.useImagePromptAddon)   _aFrags.push(PromptTemplates.get('LONG_ARTICLE_IMAGE_PROMPT_ADDON', _aOpts));

             // Sovereign schema with arrayified image_prompt
             _aFrags.push(PromptTemplates.get('LONG_ARTICLE_SOVEREIGN_IDENTITY_SCHEMA', {
                 ..._aOpts,
                 useAuditor: _aOpts.useVoidSourceAuditor,
                 useImagePromptAddon: _aOpts.useImagePromptAddon,
                 useDetailedSuggestions: _aOpts.useDetailedSuggestions
             }));

             const _aSorted = _aFrags.filter(Boolean).sort((a, b) => a.priority - b.priority);
             const _aRaw = _aSorted.map(f => `<${f.id}>\n${f.content}\n</${f.id}>`).join('\n\n');
             log('DATA', 'PROMPT_STRUCTURE_ARTICLE', _aSorted.map(s => s.id));
             log('DATA', 'PROMPT_RAW', _aRaw);
             log('AI', 'LONG_ARTICLE_PROMPT_FORGED', Language.text('MSG_PROMPT_FORGED'));
             return { structure: _aSorted.map(s => s.id), raw: _aRaw };
         }

         // [V14.5] Promotional Post — early-return branch.
         // PROFILE_DATA is the substrate; CONTEXT_DATA is NEVER injected.
         // Cognitive Origin Auditor and Social Alchemy are denied at the protocol layer (Strategy + Protocols),
         // so we only honor the remaining protocol opts that survive that restriction.
         if (config.interactionType === 'promo') {
             const _pProfile = State.get('profile_intelligence');
             const _hasProfile = !!(_pProfile && typeof _pProfile === 'object' && Object.keys(_pProfile).length > 0);
             // Belt-and-suspenders: Strategy.js auto-reverts to 'rewrite' when profile is missing, so
             // reaching here without a profile is a race. Fall through to the legacy path in that case.
             if (_hasProfile) {
                 const _pOpts = {
                     ...context, ...persona, ...config,
                     personaName:            persona.name || persona.id || 'Default',
                     anchorNode:             'CTRL_A_TEXT',  // unused but kept for schema compat
                     language_property:      'ctrl_a_text',
                     type:                   'promo',
                     interactionType:        'promo',
                     useDetailedSuggestions: State.get('detailed_suggestions'),
                     useEmoji:               State.get('emoji_enhancement'),
                     useKaomoji:             State.get('kaomoji_enhancement'),
                     useBoldify:             State.get('boldify_enhancement'),
                     useThematicTagging:     State.get('thematic_tagging'),
                     useEngagementKinetics:  State.get('engagement_kinetics'),
                     useVoidSourceAuditor:   config.voidSourceAuditor || State.get('void_source_auditor'),
                     useImagePromptAddon:    config.imagePromptAddon || config.image_prompt_addon || State.get('image_prompt_addon'),
                     useAuditor:             config.voidSourceAuditor || State.get('void_source_auditor'),
                     useCognitiveAuditor:    false,   // denied by Strategy restriction
                     useSocialAlchemy:       false,   // denied by Strategy restriction
                     hasSelection:           false,   // promo never anchors on a selection
                     attachments:            attachments,
                     hasAttachments:         attachments.length > 0,
                     hasImperative:          Array.isArray(config.imperatives) && config.imperatives.some(i => i && i.active),
                     hasDirective:           !!(config.directive && config.directive.trim())
                 };

                 const _pFrags = [];
                 _pFrags.push(PromptTemplates.get('PROMOTIONAL_POST_LINGUISTIC_SHELL',    _pOpts));
                 _pFrags.push(PromptTemplates.get('PROMOTIONAL_POST_CORE_MANDATE',        _pOpts));

                 const _pImpFrag = PromptTemplates.get('IMPERATIVES',     { imperatives: config.imperatives || [] });
                 if (_pImpFrag) _pFrags.push(_pImpFrag);
                 const _pCmFrag  = PromptTemplates.get('CUSTOM_METRICS',  { customMetrics: config.customMetrics });
                 if (_pCmFrag)  _pFrags.push(_pCmFrag);

                 _pFrags.push(PromptTemplates.get('PROMOTIONAL_POST_STRATEGIC_OBJECTIVE', _pOpts));
                 _pFrags.push(PromptTemplates.get('PERSONA_PROFILE',                     persona));

                 _pFrags.push(PromptTemplates.get('IDENTITY_ANCHOR_MEMBRANE', {
                     profileDataBlock: JSON.stringify(_pProfile, null, 2)
                 }));

                 if (_pOpts.hasAttachments) {
                     let _pAttBlock = '';
                     attachments.forEach(att => { _pAttBlock += `<ATTACHMENT name="${att.name}">\n${att.content}\n</ATTACHMENT>\n`; });
                     _pFrags.push({ id: 'ATTACHMENTS_CONTEXT', priority: 2.2, content: _pAttBlock.trim() });
                 }

                 _pFrags.push(PromptTemplates.get('ANTI_META_GATE', _pOpts));

                 if (_pOpts.hasDirective) {
                     _pFrags.push(PromptTemplates.get('DIRECTIVE_INJECTION', { text: config.directive.trim() }));
                     _pFrags.push(PromptTemplates.get('CAUSAL_VECTOR',       { directive: config.directive }));
                 }

                 if (_pOpts.useVoidSourceAuditor)  _pFrags.push(PromptTemplates.get('VOID_SOURCE_AUDITOR', _pOpts));
                 if (_pOpts.useEngagementKinetics) _pFrags.push(PromptTemplates.get('ENGAGEMENT_KINETICS', _pOpts));
                 if (_pOpts.useThematicTagging)    _pFrags.push(PromptTemplates.get('THEMATIC_TAGGING',    _pOpts));
                 if (_pOpts.useEmoji || _pOpts.useKaomoji || _pOpts.useBoldify) {
                     _pFrags.push(PromptTemplates.get('ENHANCEMENT', _pOpts));
                 }
                 if (_pOpts.useImagePromptAddon)   _pFrags.push(PromptTemplates.get('IMAGE_PROMPT_ADDON', _pOpts));

                 if (recalibration) {
                     _pFrags.push(PromptTemplates.get('SOVEREIGN_OVERRIDE', {
                         metricName: recalibration.metricName,
                         oldValue:   recalibration.oldValue,
                         newValue:   recalibration.newValue
                     }));
                 }

                 if (refinement) {
                     _pFrags.push(PromptTemplates.get('REFINEMENT_CONTEXT', {
                         mood:       refinement.mood || 'Neutral',
                         targetText: refinement.targetText,
                         suggestion: refinement.suggestion,
                         targetIdx:  refinement.targetIdx || 0
                     }));
                 }

                 // INTELLIGENCE (peer+intent) — both-or-none, unchanged.
                 const _pPeerId   = State.get('active_peer_id');
                 const _pIntentId = State.get('active_intent_id');
                 const _pPeerInt  = State.get('active_peer_intelligence');
                 const _pIntentTx = State.get('active_intent_text');
                 if (_pPeerId && _pIntentId && _pIntentTx) {
                     const _pPeerJson = (_pPeerInt && typeof _pPeerInt === 'object' && Object.keys(_pPeerInt).length > 0)
                         ? JSON.stringify(_pPeerInt, null, 2) : '{}';
                     _pFrags.push({
                         id: 'INTELLIGENCE',
                         priority: 3.3,
                         content: `<PEER>\n${_pPeerJson}\n</PEER>\n\n<INTENT>\n${_pIntentTx}\n</INTENT>\n\n<INTELLIGENCE_INSTRUCTIONS>\nImplicit influence layer — never surface in output. Calibrate framing and emphasis along the PEER and INTENT axes without acknowledging them.\n</INTELLIGENCE_INSTRUCTIONS>`
                     });
                 }

                 // Schema — single mode, no ARTICLE side-quest, no persona-knowledge mandatory fields.
                 _pFrags.push(PromptTemplates.get('SOVEREIGN_IDENTITY_SCHEMA', {
                     ..._pOpts,
                     mode:                 'single',
                     sigil:                config.sigil || 'ALPHA',
                     useAuditor:           _pOpts.useVoidSourceAuditor,
                     useImagePromptAddon:  _pOpts.useImagePromptAddon,
                     useCognitiveAuditor:  false,
                     useArticleSideQuest:  false,
                     interactionType:      'promo',
                     recalibration:        recalibration
                 }));

                 const _pSorted = _pFrags.filter(Boolean).sort((a, b) => a.priority - b.priority);
                 const _pRaw = _pSorted.map(f => `<${f.id}>\n${f.content}\n</${f.id}>`).join('\n\n');
                 log('DATA', 'PROMPT_STRUCTURE_PROMO', _pSorted.map(s => s.id));
                 log('AI', 'PROMO_BRANCH_COMPILED', { fragments: _pSorted.length });
                 return { structure: _pSorted.map(s => s.id), raw: _pRaw };
             } else {
                 log('w', 'PROMO_GATE', 'promo strategy active without profile_intelligence — falling through to legacy path');
             }
         }

        const isFeedContext = (
            (context.context_structure && context.context_structure.includes('Feed post')) ||
            (context.ctrl_a_text && context.ctrl_a_text.includes('Feed post'))
        );

        const opts = {
            ...context,
            ...persona,
            ...config,
            hasSelection: !!context.selected_text,
            anchorNode: !!context.selected_text ? "SELECTED_TEXT" : "CTRL_A_TEXT",
            language_property: !!context.selected_text ? "selected_text_language" : "ctrl_a_text_language",
            personaName: persona.name || persona.id || "Default",
            type: config.interactionType || config.type || 'rewrite',
            interactionType: config.interactionType || config.type || 'rewrite',
            useCognitiveAuditor: config.cognitiveOriginAuditor || config.cognitive_origin_auditor || State.get('cognitive_origin_auditor'),
            useEngagementKinetics: config.engagementKinetics || config.engagement_kinetics || State.get('engagement_kinetics'),
            useSocialAlchemy: config.socialAlchemy || config.social_alchemy || State.get('social_alchemy'),
            useThematicTagging: config.thematicTagging || config.thematic_tagging || State.get('thematic_tagging'),
            useDetailedSuggestions: State.get('detailed_suggestions'),
            useEmoji: State.get('emoji_enhancement'),
            useKaomoji: State.get('kaomoji_enhancement'),
            useBoldify: State.get('boldify_enhancement'),
            useImagePromptAddon: config.imagePromptAddon || config.image_prompt_addon || State.get('image_prompt_addon'),
            isFeed: isFeedContext,
            attachments: attachments,
            // [V14.5] Forward presence flags so CORE_MANDATE's STRUCTURAL_MAP can list
            // [IMPERATIVES] / [DIRECTIVE] entries conditionally for all strategies (not only promo).
            hasImperative: Array.isArray(config.imperatives) && config.imperatives.some(i => i && i.active),
            hasDirective:  !!(config.directive && config.directive.trim())
        };

        let siege_fragments = [];

        // [V13.S³] Identity Anchor Protocol
        const linkIdentityAnchor = config.link_identity_anchor || persona.link_identity_anchor || persona.link_user_profile || State.get('link_identity_anchor') || State.get('link_user_profile');
        const profileJson = context.profile_intelligence || persona.profile_intelligence || config.profile_intelligence || State.get('profile_intelligence');
        let hasIdentityAnchor = false;
        let profileDataBlock = null;

        if (linkIdentityAnchor && profileJson) {
            const isObject = typeof profileJson === 'object' && profileJson !== null;
            const hasKeys = isObject && Object.keys(profileJson).length > 0;
            if (hasKeys) {
                hasIdentityAnchor = true;
                profileDataBlock = JSON.stringify(profileJson, null, 2);
                log('LOGIC', 'IDENTITY_ANCHOR_ENGAGED', { profileLength: profileDataBlock.length });
            } else {
                log('WARN', 'IDENTITY_ANCHOR_SKIPPED', { reason: 'Empty or unparsed profile substrate json.' });
            }
        }

        // Dynamic Whitelist Logic
        if (tags && Array.isArray(tags)) {
            siege_fragments = tags.map(id => PromptTemplates.get(id, opts));
            if (hasIdentityAnchor) {
                siege_fragments.push(PromptTemplates.get('IDENTITY_ANCHOR_MEMBRANE', { profileDataBlock }));
            }
        } else {
            // Legacy Fallback
            siege_fragments.push(PromptTemplates.get('LINGUISTIC_SHELL', opts));
            siege_fragments.push(PromptTemplates.get('CORE_MANDATE', opts));
            
            // 1.5. Inject Mandatory Imperatives if present
            const imperativeFragment = PromptTemplates.get('IMPERATIVES', opts);
            if (imperativeFragment) {
                siege_fragments.push(imperativeFragment);
            }

            // [V14] 1.6. Inject Custom Metrics if any are active. The template returns null
            // when zero active customs, so symmetric purge is enforced at the template level.
            const customMetricsFragment = PromptTemplates.get('CUSTOM_METRICS', opts);
            if (customMetricsFragment) {
                siege_fragments.push(customMetricsFragment);
                log('AI', 'CUSTOM_METRICS_INJECTED', { count: (opts.customMetrics || []).filter(m => m && m.active).length, branch: 'legacy' });
            }

            siege_fragments.push(PromptTemplates.get('STRATEGIC_OBJECTIVE', { type: opts.type }));
            siege_fragments.push(PromptTemplates.get('PERSONA_PROFILE', persona));

            if (hasIdentityAnchor) {
                siege_fragments.push(PromptTemplates.get('IDENTITY_ANCHOR_MEMBRANE', { profileDataBlock }));
            }

            if (opts.hasSelection) {
                siege_fragments.push(PromptTemplates.get('RELATIONAL_ANCHORING'));
                siege_fragments.push(PromptTemplates.get('COGNITIVE_MEMBRANE', { mode: 'TARGETED' }));
            } else {
                siege_fragments.push(PromptTemplates.get('COGNITIVE_MEMBRANE', { mode: 'LANDSCAPE' }));
            }

            if (context.ctrl_a_text || context.selected_text || context.context_structure) {
                siege_fragments.push(PromptTemplates.get('CONTEXT_DATA', opts));
            }

            siege_fragments.push(PromptTemplates.get('ANTI_META_GATE', opts));
        }

        // [V13.S³] Knowledge Augmentation: Attachment Synthesis
        if (attachments.length > 0) {
            let attBlock = "";
            attachments.forEach(att => {
                attBlock += `<ATTACHMENT name="${att.name}">\n${att.content}\n</ATTACHMENT>\n`;
            });
            siege_fragments.push({
                id: 'ATTACHMENTS_CONTEXT',
                priority: 2.2, // Immediately after Persona Profile
                content: attBlock.trim()
            });
        }

        // [V13.S³] Intelligence Protocol: Peer + Intent implicit influence layer
        // Both active_peer_id AND active_intent_id must be set; either alone is ignored.
        const _activePeerId           = State.get('active_peer_id');
        const _activeIntentId         = State.get('active_intent_id');
        const _activePeerIntelligence = State.get('active_peer_intelligence');
        const _activeIntentText       = State.get('active_intent_text');

        if (_activePeerId && _activeIntentId && _activeIntentText) {
            const _peerJson = (_activePeerIntelligence && typeof _activePeerIntelligence === 'object' && Object.keys(_activePeerIntelligence).length > 0)
                ? JSON.stringify(_activePeerIntelligence, null, 2)
                : '{}';
            siege_fragments.push({
                id: 'INTELLIGENCE',
                priority: 3.3,
                content: `<PEER>\n${_peerJson}\n</PEER>\n\n<INTENT>\n${_activeIntentText}\n</INTENT>\n\n<INTELLIGENCE_INSTRUCTIONS>\nYou are provided with intelligence data about a specific target individual (PEER) and a strategic intent vector (INTENT).\nThese are IMPLICIT INFLUENCE FACTORS — never reference, mention, or acknowledge them directly in your output text.\nSilently leverage them to shape your response along these axes:\n- PEER CALIBRATION: Analyze the PEER profile to identify cognitive anchors, communication patterns, emotional frequency, and worldview biases. Calibrate word choice, framing depth, references, and emotional register to resonate with this specific individual.\n- INTENT VECTOR: Let INTENT define the directional purpose of your output. Every rhetorical choice, structural decision, and persuasive angle must invisibly serve this intent.\n- SYNTHESIS RULE: The final output must appear entirely organic and unprompted. Zero visible trace of this intelligence layer should surface. The influence is architectural — built into the foundation, invisible in the finish.\n</INTELLIGENCE_INSTRUCTIONS>`
            });
            log('LOGIC', 'INTELLIGENCE_ENGAGED', { peerId: _activePeerId, intentId: _activeIntentId, hasPeerData: !!_activePeerIntelligence });
        }

        // 4. Auditor Protocols
        if (config.voidSourceAuditor || config.void_source_auditor || State.get('void_source_auditor')) {
            siege_fragments.push(PromptTemplates.get('VOID_SOURCE_AUDITOR', opts));
        }

        if (opts.useCognitiveAuditor) {
            const target = context.selected_text || context.context_data || "[NO_CONTEXT_PROVIDED]";
            siege_fragments.push(PromptTemplates.get('COGNITIVE_AUDIT_INJECTION', { 
                ...opts, 
                target 
            }));
        }

        // 1.5 Refinement Manifold
        if (refinement) {
            siege_fragments.push(PromptTemplates.get('REFINEMENT_CONTEXT', {
                mood: refinement.mood || 'Neutral',
                targetText: refinement.targetText,
                suggestion: refinement.suggestion,
                targetIdx: refinement.targetIdx || 0
            }));
        }

        // 1.6 Recalibration Override
        if (recalibration) {
            siege_fragments.push(PromptTemplates.get('SOVEREIGN_OVERRIDE', {
                metricName: recalibration.metricName,
                oldValue: recalibration.oldValue,
                newValue: recalibration.newValue
            }));
        }

        // 4. Dynamic Vector (Causal Anchor)
        if (config.directive) {
            siege_fragments.push(PromptTemplates.get('CAUSAL_VECTOR', { directive: config.directive }));
        }

        // 4.5 User Directive Citadel Injection
        if (config.directive && config.directive.trim()) {
            siege_fragments.push(PromptTemplates.get('DIRECTIVE_INJECTION', { text: config.directive.trim() }));
        }

        if (opts.useEngagementKinetics) {
            siege_fragments.push(PromptTemplates.get('ENGAGEMENT_KINETICS', opts));
        }

        if (opts.useSocialAlchemy) {
            const alchemyFragment = PromptTemplates.get('SOCIAL_ALCHEMY', opts);
            if (alchemyFragment) siege_fragments.push(alchemyFragment);
        }

        if (opts.useThematicTagging) {
            siege_fragments.push(PromptTemplates.get('THEMATIC_TAGGING', opts));
        }

        if (opts.useEmoji || opts.useKaomoji || opts.useBoldify) {
            siege_fragments.push(PromptTemplates.get('ENHANCEMENT', opts));
        }

        if (opts.useImagePromptAddon) {
            siege_fragments.push(PromptTemplates.get('IMAGE_PROMPT_ADDON', opts));
        }

        if (config.mode === 'nexus') {
            siege_fragments.push(PromptTemplates.get('OUTPUT_NEXUS', { ...opts, sigil: config.sigil }));
        } else if (config.mode === 'matrix') {
            siege_fragments.push(PromptTemplates.get('MATRIX_MANDATE'));
        }

        // 5. Sovereign Seal (Schema Poisoning)
        // [ARTICLE] Pre-compute side-quest flag BEFORE schema build, so the schema can natively include the 3 article fields.
        const _sqEarlyActiveId = State.get('active_article_id');
        const _sqEarlyPrepEligible = ['rewrite', 'comment', 'reaction', 'promo'].includes(config.interactionType);
        let _sqEarlyArticle = null;
        if (_sqEarlyActiveId && _sqEarlyPrepEligible) {
            const _earlyArticles = State.get('articles') || [];
            _sqEarlyArticle = _earlyArticles.find(a => a.id === _sqEarlyActiveId) || null;
        }
        const _useArticleSideQuest = !!_sqEarlyArticle;

        if (!siege_fragments.find(f => f.id === 'SOVEREIGN_IDENTITY_SCHEMA')) {
            siege_fragments.push(PromptTemplates.get('SOVEREIGN_IDENTITY_SCHEMA', { 
                ...opts,
                mode: config.mode || 'single', 
                sigil: config.sigil || 'ALPHA', 
                useAuditor: config.voidSourceAuditor || config.void_source_auditor || State.get('void_source_auditor'),
                useCognitiveAuditor: opts.useCognitiveAuditor,
                useImagePromptAddon: opts.useImagePromptAddon,
                interactionType: config.interactionType,
                useArticleSideQuest: _useArticleSideQuest,
                // [V14] Forward recalibration so SOVEREIGN_IDENTITY_SCHEMA can pin target/[0-100]
                // placeholders. customMetrics already flows through via ...opts (config spread).
                recalibration: recalibration
            }));
        }

        // [V13.S³] Persona Learning Context Logic: Structural Inference
        const isRefinement = !!input.refinement;
        const typeKey = input.type || config.interactionType || 'transmutation';
        // [V14] Metric Alchemy types join the existing predicates so the forbiddenIds filter
        // (AUDIT/ENGAGEMENT/ADDON/...) applies uniformly to metric_synthesis/mutation/crossbreed.
        // isLearningContext intentionally remains coupled to isAlchemyEvolution — metric mutation
        // and crossbreed do NOT carry persona_knowledge, so the learning context auto-skips them
        // because metric alchemy uses a tags-whitelist branch upstream (no PERSONA_KNOWLEDGE chunk).
        const isAlchemyEvolution = ['mutation', 'crossbreed', 'alchemy_mutate', 'alchemy_crossbreed', 'metric_mutation', 'metric_crossbreed'].includes(typeKey);
        const isAlchemyCreation = ['synthesis', 'metric_synthesis'].includes(typeKey);
        const isImgImprov = typeKey === 'image_prompt_improvement';
        
        const isBaseTransmutation = !(isRefinement || isAlchemyCreation || isAlchemyEvolution || isImgImprov);
        const isLearningContext = isBaseTransmutation || isRefinement || isAlchemyEvolution;
        const isTransmutation = isBaseTransmutation;
        const isAlchemy = isAlchemyCreation || isAlchemyEvolution;

        if (isAlchemy) {
            const forbiddenIds = ['AUDIT', 'ENGAGEMENT', 'ADDON', 'ENHANCEMENT', 'SOCIAL_ALCHEMY', 'THEMATIC_TAGGING', 'COGNITIVE_AUDIT_INJECTION', 'VOID_SOURCE_AUDITOR', 'ENGAGEMENT_KINETICS', 'IMAGE_PROMPT_ADDON'];
            siege_fragments = siege_fragments.filter(f => f && typeof f.id === 'string' && !forbiddenIds.includes(f.id));
        }

        // [V13.S³] Knowledge Priority Matrix (Alchemical Isolation)
        let rawKnowledge = [];
        let knowledgeSource = 'none';
        
        if (typeKey === 'crossbreed' || typeKey === 'alchemy_crossbreed') {
            const k1 = config.sourcePersona1?.persona_knowledge || [];
            const k2 = config.sourcePersona2?.persona_knowledge || [];
            rawKnowledge = [...k1, ...k2];
            knowledgeSource = 'crossbreed_parents';
        } else if (typeKey === 'mutation' || typeKey === 'alchemy_mutate') {
            rawKnowledge = config.sourcePersona?.persona_knowledge || [];
            knowledgeSource = 'mutation_subject';
        } else {
            rawKnowledge = persona.persona_knowledge || [];
            knowledgeSource = 'active_persona';
        }

        // [V13.S³] Defensive Cloning: Sever memory references to global UI State
        // This prevents the Accumulator Effect where shared memory pointers cause 
        // global knowledge leakage between specific personas during mutation.
        const pKnowledge = JSON.parse(JSON.stringify(rawKnowledge));
        
        log('LOGIC', 'KNOWLEDGE_ISOLATION', { 
            typeKey, 
            source: knowledgeSource, 
            rawLength: rawKnowledge.length,
            clonedLength: pKnowledge.length 
        });

        let _gatePersona = null;
        let _learnsGate = false;

        if (isLearningContext) {
            // [V14.5] Per-persona learning gate. Mutation/crossbreed source personas are checked
            // independently via their own learns_from_context flag (priority matrix above already
            // selected the source persona's knowledge; here we check whether to expose it at all).
            _gatePersona = (typeKey === 'crossbreed' || typeKey === 'alchemy_crossbreed')
                ? (config.sourcePersona1 || config.sourcePersona2)
                : (typeKey === 'mutation' || typeKey === 'alchemy_mutate')
                    ? config.sourcePersona
                    : persona;
            _learnsGate = (_gatePersona && _gatePersona.learns_from_context !== false);
            if (_learnsGate) {
                siege_fragments.push(PromptTemplates.get('PERSONA_KNOWLEDGE', { knowledge: pKnowledge }));
                siege_fragments.push(PromptTemplates.get('PERSONA_USE_KNOWLEDGE_INSTRUCTIONS', { type: typeKey }));
                log('LOGIC', 'PERSONA_LEARNING_GATE', { gate: 'on', persona: _gatePersona?.id });
            } else {
                log('LOGIC', 'PERSONA_LEARNING_GATE', { gate: 'off', persona: _gatePersona?.id });
            }
        }
        const _transmuteLearns = (persona && persona.learns_from_context !== false);
        if (isTransmutation && _transmuteLearns) {
             siege_fragments.push(PromptTemplates.get('PERSONA_KNOWLEDGE_UPDATE_PROTOCOL', { count: pKnowledge.length, threshold: config.personaKnowledgeThreshold }));
             log('LOGIC', 'PERSONA_THRESHOLD_RESOLVED', { threshold: config.personaKnowledgeThreshold, count: pKnowledge.length });
        }
         // [V13] Inherit-Knowledge gate — opt-in via the Alchemy UI checkbox. When set on the
         // mutation/crossbreed config, swap in the "add"-only inheritance protocol so the AI
         // forges the new persona's seed knowledge by evolving/crossbreeding the source(s).
         // Mutually exclusive with isTransmutation (which already injects the standard protocol).
         const isAlchemyInherit = isAlchemyEvolution && config.inheritKnowledge === true;
         if (isAlchemyInherit) {
             siege_fragments.push(PromptTemplates.get('PERSONA_KNOWLEDGE_INHERIT_PROTOCOL', { type: typeKey }));
         }

        // Schema Injection for Persona Learning
        const schemaFrag = siege_fragments.find(f => f && typeof f.id === 'string' && f.id.includes('SCHEMA'));
        if (schemaFrag) {
            if (isLearningContext && _learnsGate) schemaFrag.content += `\n[MANDATORY FIELD]: You MUST include "persona_knowledge_reasoning" (string) in your root JSON object.`;
            if (isAlchemy) schemaFrag.content += `\n[STRICT]: Return the identity object/array directly at the ROOT. DO NOT wrap in "identities", "personas", or any other container key.`;
            if (isTransmutation && _transmuteLearns) schemaFrag.content += `\n[MANDATORY FIELD]: You MUST include "update_persona_knowledge" (array) in your root JSON object following the PERSONA_KNOWLEDGE_UPDATE_PROTOCOL.`;
             if (isAlchemyInherit) schemaFrag.content += `\n[MANDATORY FIELD]: You MUST include "update_persona_knowledge" (array) in your root JSON object following the PERSONA_KNOWLEDGE_UPDATE_PROTOCOL.`;
        }

         // [ARTICLE] Side-quest: if an active article exists and Strategy is prep-eligible, inject SIDE_QUEST + extend schema
         // (Native fields already woven into SOVEREIGN_IDENTITY_SCHEMA via opts.useArticleSideQuest above.)
         if (_useArticleSideQuest && _sqEarlyArticle) {
             siege_fragments.push(PromptTemplates.get('SIDE_QUEST_ARTICLE_PREPARATION', {
                 attributes: _sqEarlyArticle.attributes,
                 materials:  _sqEarlyArticle.materials || []
             }));
             log('LOGIC', 'ARTICLE_SIDE_QUEST_INJECTED', { articleId: _sqEarlyActiveId, mode: 'native-schema' });
         }

        if (config.twitter_short || State.get('twitter_short')) {
            siege_fragments.push(PromptTemplates.get('TWITTER_SHORT'));
        }

        // [LOCAL_DATE] Anchor a <LOCAL_DATE>[Year/Month_word]</LOCAL_DATE> marker at the very top
        // of the prompt — ONLY for base transmutation and refinement (suggestion / metric-recalibration
        // / text-length) flows. Alchemy, article, promo and image-prompt paths are excluded (they
        // either early-return upstream or fail the isTransmutation/isRefinement predicates here).
        if (isTransmutation || isRefinement || !!recalibration) {
            siege_fragments.push(PromptTemplates.get('LOCAL_DATE', {}));
        }

        // 6. Forging & Unification
        const sorted = siege_fragments.sort((a, b) => a.priority - b.priority);
        
        const collapsibleIds = ['ENGAGEMENT', 'AUDIT', 'ADDON', 'COGNITIVE_MEMBRANE'];
        const grouped = [];
        const groupMap = new Map();

        sorted.forEach(f => {
            if (collapsibleIds.includes(f.id)) {
                if (!groupMap.has(f.id)) {
                    const container = { ...f };
                    groupMap.set(f.id, container);
                    grouped.push(container);
                } else {
                    groupMap.get(f.id).content += `\n\n${f.content}`;
                }
            } else {
                grouped.push(f);
            }
        });

        const raw = grouped.map(f => `<${f.id}>\n${f.content}\n</${f.id}>`).join('\n\n');
        
        log('DATA', 'PROMPT_STRUCTURE', grouped.map(s => s.id));
        log('DATA', 'PROMPT_RAW', raw);
        log('AI', 'PROMPT_FORGED', Language.text('MSG_PROMPT_FORGED'));
        
        return { structure: grouped.map(s => s.id), raw };
    }
};