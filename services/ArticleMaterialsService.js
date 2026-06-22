/**
 * @file services/ArticleMaterialsService.js
 * @purpose Atomic Article Materials Evolution Substrate.
 *          Mirrors IntelligenceService.processLearningUpdates with article-scoped sovereignty.
 */
import { log } from '../utils/logger.js';
import { Storage } from './Storage.js';
import { State } from './State.js';

const RESERVED_KEYS = new Set(['command', 'content', 'type', 'index', 'indexes', 'contents', 'elements', 'synthesis']);

function spreadCustomProperties(cmd) {
    const extra = {};
    for (const k of Object.keys(cmd || {})) {
        if (!RESERVED_KEYS.has(k)) extra[k] = cmd[k];
    }
    return extra;
}

export const ArticleMaterialsService = {
    async processMaterialsUpdates(response_data, context_type) {
        const whitelist = ['transmutation', 'refinement'];
        if (!whitelist.includes(context_type) || !response_data) return { delta: 0, added: [], synthesized: [], advice: '' };

        const reasoning = response_data.article_materials_reasoning;
        if (reasoning) {
            log('AI', 'MATERIALS_REASONING', { type: context_type, content: reasoning });
        }

        const _advice = (typeof response_data.article_materials_advice === 'string')
            ? response_data.article_materials_advice.trim()
            : '';        

        const updates = response_data.update_article_materials;
        if (!Array.isArray(updates) || updates.length === 0) {
            // Advice may still arrive without material updates — persist it standalone.
            if (_advice) {
                const articleId = State.get('active_article_id');
                if (articleId) {
                    const articles = (await Storage.get('articles')) || [];
                    const idx = articles.findIndex(a => a.id === articleId);
                    if (idx !== -1) {
                        articles[idx].advice = _advice;
                        await Storage.set({ articles });
                        State.set('articles', articles);
                    }
                }
            }
            return { delta: 0, added: [], synthesized: [], advice: _advice };
        }

        const articleId = State.get('active_article_id');
        if (!articleId) {
            log('w', 'MATERIALS_SYNC', 'Abort: no active article.');
            return { delta: 0, added: [], synthesized: [], advice: _advice };
        }

        const articles = (await Storage.get('articles')) || [];
        const idx = articles.findIndex(a => a.id === articleId);
        if (idx === -1) return { delta: 0, added: [], synthesized: [], advice: _advice };

        // [V13.S³] Defensive Cloning — sever shared memory pointers.
        let materials = JSON.parse(JSON.stringify(articles[idx].materials || []));
        const initialLen = materials.length;
        const _added = [];
        const _synthesized = [];        

        for (const cmd of updates) {
            if (!cmd || !cmd.command) continue;

            if (cmd.command === 'add' && cmd.content) {
                const _newItem = { content: cmd.content, type: cmd.type || 'insight', ...spreadCustomProperties(cmd) };
                materials.push(_newItem);
                _added.push(_newItem);
            } else if (cmd.command === 'remove' || cmd.command === 'delete') {
                if (typeof cmd.index === 'number' && cmd.index >= 0 && cmd.index < materials.length) {
                    materials.splice(cmd.index, 1);
                } else if (cmd.content) {
                    materials = materials.filter(m => m.content !== cmd.content);
                }
            } else if (cmd.command === 'synthesize') {
                const toRemove = new Set();
                if (Array.isArray(cmd.indexes)) {
                    cmd.indexes.forEach(i => {
                        if (typeof i === 'number' && i >= 0 && i < materials.length) toRemove.add(i);
                    });
                }
                const sources = Array.isArray(cmd.contents) ? cmd.contents : (Array.isArray(cmd.elements) ? cmd.elements : []);
                sources.forEach(c => {
                    const foundIdx = materials.findIndex(m => m.content === c);
                    if (foundIdx !== -1) toRemove.add(foundIdx);
                });
                // Atomic Incineration: DESC splice
                Array.from(toRemove).sort((a, b) => b - a).forEach(i => materials.splice(i, 1));
                if (cmd.synthesis) {
                    const _newItem = { content: cmd.synthesis, type: cmd.type || 'synthesis', ...spreadCustomProperties(cmd) };
                    materials.push(_newItem);
                    _synthesized.push(_newItem);
                }
            }
        }

        articles[idx].materials = materials;
        articles[idx].materialsCount = materials.length;
        // [LATEST BATCH] count of items added in THIS batch (add + synthesize). Cleared on user selection of the article.
        articles[idx].lastBatchAddedCount = _added.length + _synthesized.length;
        if (_advice) articles[idx].advice = _advice;

        await Storage.set({ articles: articles });
        State.set('articles', articles);

        const delta = materials.length - initialLen;
        log('DATA', 'MATERIALS_EVOLVED', { articleId, delta, count: materials.length });
        return { delta, added: _added, synthesized: _synthesized, advice: _advice };
    },

    // [V17] Single-source materials resolver. Output records reference the live article by
    // articleId instead of embedding a materials snapshot. Legacy fallback: records generated
    // before de-duplication still carry dna.materials.
    async resolveMaterials(record) {
        if (!record) return [];
        if (record.articleId) {
            const articles = (await Storage.get('articles')) || [];
            const live = articles.find(a => a.id === record.articleId);
            if (live && Array.isArray(live.materials)) return live.materials;
        }
        if (record.dna && Array.isArray(record.dna.materials)) return record.dna.materials;
        return [];
    }
};

// Sovereign Global Registration (per coding_standards.md "window-global entities for core services").
if (typeof window !== 'undefined') {
    window.ArticleMaterialsService = ArticleMaterialsService;
}
