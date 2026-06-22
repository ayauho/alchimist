export const MODEL_HIERARCHY = [
    'gemini-3.5-flash',       // Tier 0 (Newest Elite Reasoning)
    'gemini-3.1-pro-preview', // Tier 0 (Elite Reasoning)
    'gemini-3-flash-preview', // Tier 1 (Elite)    
    'gemini-2.5-pro',         // Tier 2 (High Reasoning)
    'gemini-2.5-flash',       // Tier 3 (Standard/Default)
    'gemini-3.1-flash-lite'   // Tier 4 (Light)
];

export const INITIAL_SLOT_STATE = (id) => ({
    id,
    apiKey: '',
    preferredModel: MODEL_HIERARCHY[0],
    currentModel: MODEL_HIERARCHY[0],
    isActive: id === 1,
    lastExpired: null
});

// [V14] Custom Metrics — storage + collision-guard + voice-profile constants
export const METRICS_STORAGE_KEY = 'metrics';

/**
 * Names reserved by the AI-defined metric schema. User-defined metric names
 * colliding with these are soft-blocked at save time (case-insensitive) to
 * prevent Sanctuary.Metrics.dispatchRecalibration from mis-classifying
 * recalibration targets between AI- and custom-defined metric paths.
 */
export const RESERVED_METRIC_NAMES = [
    'Logic', 'Integrity', 'Craft', 'Entropy',
    'Power', 'Resonance', 'Harmony', 'Holism'
];

// Voice profiles passed to PromptCompiler as the persona block for Metric Alchemy paths.
export const ALCHEMIST_VOICE_METRIC_SYNTH = {
    name: 'Metric Synthesizer',
    prompt: 'Synthesize a single Metric from the linguistic patterns of CONTEXT_DATA. The Metric MUST measure one crisp dimension of resonance. Name is a single noun or short noun phrase (max 3 words). Description is 1-2 sentences explaining what is measured and how to interpret a value near 0 versus a value near 100. Do NOT use a name from RESERVED_METRIC_NAMES.'
};

export const ALCHEMIST_VOICE_METRIC_MUTATE = {
    name: 'Metric Mutator',
    prompt: 'Perform a high-dimensional mutation of the SOURCE_METRIC. Preserve 40-60% of the source intent while evolving naming, measurement axis, and interpretive depth. Define a NEW unique id (slug).'
};

export const ALCHEMIST_VOICE_METRIC_CROSS = {
    name: 'Metric Crossbreeder',
    prompt: 'Perform a high-dimensional merge of the SOURCE_METRICS. DNA PRESERVATION: the merged metric must contain 40-60% of essence from each source. NAME LINEAGE: the new name must be an evolved or derivative form of both source names. Define a NEW unique id (slug).'
};

// [PREMIUM] Sovereign-tier purchase egress + feature manifest source-of-truth.
// STORE_URL is config (not user-facing copy) -> lives here; imported by PremiumCover.onBuy().
export const STORE_URL = 'https://www.getly.store/product/lchimist-browser-intelligence-persona-alchemy-engine';

// Ordered [TOKEN_ID, fallback] pairs. PremiumCover iterates this once (no markup mirroring);
// fallbacks guarantee legibility during dictionary voids per coding_standards i18n rule.
export const PREMIUM_FEATURE_TOKENS = [
    ['FEATURE_INFINITE_PERSONAS',    'Infinite personas'],
    ['FEATURE_INFINITE_IMPERATIVES', 'Infinite imperatives'],
    ['FEATURE_INFINITE_ATTACHMENTS', 'Infinite attachments'],
    ['FEATURE_INFINITE_METRICS',     'Infinite custom metrics'],
    ['FEATURE_INFINITE_CHARACTERS',  'Infinite characters'],
    ['FEATURE_INFINITE_ARCHETYPES',  'Infinite archetypes'],
    ['FEATURE_INFINITE_PEERS',       'Infinite peers'],
    ['FEATURE_INFINITE_INTENTS',     'Infinite intents'],
    ['FEATURE_PERSONA_ALCHEMY',      'Persona alchemy'],
    ['FEATURE_METRIC_ALCHEMY',       'Metric alchemy'],
    ['FEATURE_NEXUS_MODE',           'Sequential thread output mode'],
    ['FEATURE_ALL_PROTOCOLS',        'All protocols'],
    ['FEATURE_ARTICLES',             'Articles'],
    ['FEATURE_PRESETS',              'Presets'],
    ['FEATURE_MULTI_API_KEYS',       'Multiple AI API keys'],
    ['FEATURE_SNAPSHOTS',            'Saving/restoring snapshots']
];
