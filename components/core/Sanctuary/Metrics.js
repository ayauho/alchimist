/**
 * @file components/core/Sanctuary/Metrics.js
 * @purpose Pure UI generation for Resonance Metrics
 */
import { dom } from '../../../utils/dom.js';
import { log } from '../../../utils/logger.js';
import { State } from '../../../services/State.js';

export const Metrics = {
    render(metricsData, recordId, targetIdx = 0, directive = '') {
        if (!metricsData || Object.keys(metricsData).length === 0) return dom.create('div', 'hidden');

        const container = dom.create('div', 'metrics-container flex flex-col gap-2 pt-2 border-t border-[#27272a]');
        container.dataset.activeVariation = targetIdx;

        for (const [mName, mVal] of Object.entries(metricsData)) {
            const numVal = parseInt(mVal, 10) || 0;
            
            const svgProps = 'width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"';
            
            // Dynamic HSL Interpolation: 0 (Red) -> 140 (Green) based on value
            const getBarColor = (val) => `hsl(${Math.max(0, Math.min(140, Math.floor(val * 1.4)))}, 80%, 45%)`;
            const btns = `
                <button class="metric-adj-btn" data-m="${mName}" data-t="du" title="Set to Max"><svg ${svgProps}><polyline points="18 19 12 13 6 19"></polyline><polyline points="18 12 12 6 6 12"></polyline></svg></button>
                <button class="metric-adj-btn" data-m="${mName}" data-t="u" title="Up"><svg ${svgProps}><polyline points="18 15 12 9 6 15"></polyline></svg></button>
                <button class="metric-adj-btn" data-m="${mName}" data-t="d" title="Down"><svg ${svgProps}><polyline points="6 9 12 15 18 9"></polyline></svg></button>
                <button class="metric-adj-btn" data-m="${mName}" data-t="dd" title="Set to Min"><svg ${svgProps}><polyline points="6 5 12 11 18 5"></polyline><polyline points="6 12 12 18 18 12"></polyline></svg></button>
            `;

            const row = dom.create('div', 'metric-row');
            
            // Dual-Label Masking Strategy per Rule V13.G
            row.innerHTML = `
                <div class="metric-vessel" style="--m-val: ${numVal};">
                    <div class="bar-track">
                        <div class="label-under">${mName}</div>
                        <div class="bar-fill" style="background-color: ${getBarColor(numVal)};">
                            <div class="label-over">${mName}</div>
                        </div>
                    </div>
                </div>
                <div class="metric-digit">${numVal}</div>
                <div class="metric-controls">${btns}</div>
            `;
        
            row.querySelectorAll('.metric-adj-btn').forEach(btn => {
                btn.onclick = () => this.dispatchRecalibration(btn.dataset.m, btn.dataset.t, numVal, recordId, targetIdx, directive);
            });
            container.appendChild(row);
        }

        return container;
    },

    dispatchRecalibration(metricName, type, currentValue, recordId, targetIdx = 0, directive = '') {
        let targetValue;
        switch(type) {
            case 'du': targetValue = 100; State.set('is_increasing_value', true); break;
            case 'u':  targetValue = Math.min(100, currentValue + 25); State.set('is_increasing_value', true); break;
            case 'd':  targetValue = Math.max(0, currentValue - 25); State.set('is_decreasing_value', true); break;
            case 'dd': targetValue = 0; State.set('is_decreasing_value', true); break;
            default: return;
        }

        log('UI', 'METRIC_SHIFT', { metric: metricName, type, from: currentValue, to: targetValue, id: recordId });
    
        // [V14] Classify recalibration target so the prompt schema can pin the value into the
        // correct slot. AI-defined metrics live nowhere in State (they come from LLM output);
        // custom metrics live in State.get('metrics') as the user-defined sovereign array.
        const isCustomMetric = ((State.get('metrics') || []).some(m => m && m.active && m.name === metricName));
        log('LOGIC', 'METRIC_RECALIBRATION_CLASSIFIED', { metricName, isCustomMetric });

        try {
            window.dispatchEvent(new CustomEvent('METRIC_RECALIBRATE_REQUEST', {
                detail: { originalId: recordId, metricName, oldValue: currentValue, newValue: targetValue, targetIdx, isRecalibration: true, isCustomMetric, directive }
            }));
        } catch (err) {
            log('e', 'RECALIBRATION_ERROR', err.message);
            State.set('is_error', err);
        }
    }
};