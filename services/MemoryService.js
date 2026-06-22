import { log, Logger } from '../utils/logger.js';
import { State } from './State.js';
import { Storage } from './Storage.js';
import { Language } from './Language.js';

export const MemoryService = {
    STOCKS: {
        outputs: { min: 128 * 1024, max: 512 * 1024, vol: 0 },
        persona: { min: 256 * 1024, max: 512 * 1024, vol: 0 },
        attachment: { min: 0 * 1024, max: 1024 * 1024, vol: 0 },
        imperative: { min: 0 * 1024, max: 512 * 1024, vol: 0 },
        articles: { min: 0 * 1024, max: 512 * 1024, vol: 0 },
        libraryArticles: { min: 0 * 1024, max: 512 * 1024, vol: 0 }
    },

    async init() {
        const saved = await Storage.get('memory_stocks_config');
        if (saved) {
            Object.keys(this.STOCKS).forEach(key => {
                if (saved[key]) this.STOCKS[key].max = saved[key].max;
            });
        }
        await this.updateVolumes();
    },

    async updateVolumes() {
        const outputsData = await Storage.get('currentOutputs') || [];
        const outputs = Array.isArray(outputsData) ? outputsData : [];
        this.STOCKS.outputs.vol = new Blob([JSON.stringify(outputs)]).size;

        const personas = await Storage.get('personas') || {};
        const personaSize = new Blob([JSON.stringify(personas)]).size;

        const tags = await Storage.get('tags_registry') || {};
        const tagsSize = new Blob([JSON.stringify(tags)]).size;

        // Implicitly include tags volume in persona stock
        this.STOCKS.persona.vol = personaSize + tagsSize;

        const attachments = await Storage.get('attachments') || [];
        this.STOCKS.attachment.vol = new Blob([JSON.stringify(attachments)]).size;

        const imperatives = await Storage.get('imperatives') || [];
        this.STOCKS.imperative.vol = new Blob([JSON.stringify(imperatives)]).size;

        // [V17] Article substrates as distinct stocks: 'articles' = prepared definitions
        // (attributes + materials, single source of truth); 'libraryArticles' = generated outputs.
        const articlesData = await Storage.get('articles') || [];
        this.STOCKS.articles.vol = new Blob([JSON.stringify(articlesData)]).size;

        const libraryData = await Storage.get('libraryArticles') || [];
        this.STOCKS.libraryArticles.vol = new Blob([JSON.stringify(libraryData)]).size;

        const totalLimit = parseInt(localStorage.getItem('memoryLimit') || 0);
        
        let usedBytes = 0;
        Object.keys(this.STOCKS).forEach(key => {
            usedBytes += this.STOCKS[key].vol;
        });
        
        let physicalTotal = 0;
        try {
            const config = await Storage.get('config') || {};
            const apiSlots = await Storage.get('api_slots') || [];
            physicalTotal = usedBytes + new Blob([JSON.stringify(config)]).size + new Blob([JSON.stringify(apiSlots)]).size;
        } catch (e) {
            physicalTotal = usedBytes;
        }
        
        log('DATA', 'MEMORY_STATS', `Calculated used space: ${physicalTotal} bytes`);

        State.set('memory_stats', {
            total: totalLimit,
            used: physicalTotal,
            stocks: { ...this.STOCKS }
        });
    },

    async validateTransaction(stockId, newDataSize, context = 'save') {
        await this.updateVolumes();
        const stock = this.STOCKS[stockId] || { vol: 0, max: 1024 * 512 };
        const projected = stock.vol + newDataSize;

        if (projected > stock.max) {
            if (stockId === 'outputs') {
                this.performFIFO('outputs', newDataSize);
                return true;
            }
            this.triggerOverflowError(stockId, context);
            return false;
        }
        return true;
    },

    async performFIFO(stockId) {
        if (stockId !== 'outputs') return;
        const config = await Storage.get('config') || {};
        const limit = config.maxSavedOutputs || 20;
        const current = await Storage.get('currentOutputs') || [];
        if (current.length > limit) {
            // Delegate to Storage.set — its FIFO interceptor handles the timestamp-sorted slice.
            await Storage.set({ currentOutputs: current });
            log('DATA', 'MEMORY_FIFO_EXECUTED', { stock: stockId, limit, trimmed: current.length - limit });
        }
    },

    triggerOverflowError(stockId, context) {
        let token = 'ERR_MEM_GENERIC_OVERFLOW';
        if (stockId === 'persona') {
            token = context === 'create' ? 'ERR_MEM_PERSONA_CREATE_OVERFLOW' : 
                    context === 'knowledge' ? 'ERR_MEM_PERSONA_KNOWLEDGE_OVERFLOW' : 'ERR_MEM_PERSONA_SAVE_OVERFLOW';
        } else if (stockId === 'attachment') {
            token = context === 'create' ? 'ERR_MEM_ATTACHMENT_CREATE_OVERFLOW' : 'ERR_MEM_ATTACHMENT_SAVE_OVERFLOW';
        } else if (stockId === 'imperative') {
            token = context === 'create' ? 'ERR_MEM_IMPERATIVE_CREATE_OVERFLOW' : 'ERR_MEM_IMPERATIVE_SAVE_OVERFLOW';
        }

        const msg = Language.text(token);
        log('DATA', 'OVERFLOW', { stockId, context, msg });
        window.dispatchEvent(new CustomEvent('MEMORY_OVERFLOW', { detail: { msg, stockId } }));
    },

    checkMemoryCapacity: () => {
        if (localStorage.getItem('memoryLimit')) return;

        log('LOGIC', 'MEMORY_LIMIT_DETECT', 'Starting 10kb iterative write test to determine limit...');
        const chunk10kb = '0123456789'.repeat(1024);
        let i = 0;
        const testKeyPrefix = '_mem_test_';

        try {
            while (true) {
                localStorage.setItem(`${testKeyPrefix}${i}`, chunk10kb);
                i++;
            }
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.message?.includes('quota') || e.message?.includes('storage')) {
                const limitKb = i * 10;
                log('LOGIC', 'MEMORY_LIMIT_DETECT', `Limit detected: ~${limitKb}KB`);
                
                // Clean up test data
                for (let j = 0; j < i; j++) {
                    localStorage.removeItem(`${testKeyPrefix}${j}`);
                }
                
                localStorage.setItem('memoryLimit', (limitKb * 1024).toString());
            } else {
                log('LOGIC', 'MEMORY_LIMIT_DETECT', `Error during test: ${e.message}`);
                localStorage.setItem('memoryLimit', (5 * 1024 * 1024).toString()); // Fallback to 5MB
            }
        }
    }
};
