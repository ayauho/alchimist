/**
 * Proportional Value Distributor Module
 * 
 * Exports:
 * - `ValueDistributor`: Core mathematical state logic.
 * - `DistributorUI`: HTML/DOM UI wrapper.
 */

export class ValueDistributor {
    constructor(total, initialValues, minValues, thresholds, activeThresholds, onChange) {
        this.total = total;
        this.values = { ...initialValues };
        this.minValues = { ...minValues };
        this.thresholds = { ...thresholds };
        this.activeThresholds = { ...activeThresholds };
        this.onChange = onChange;
        this.dragState = null;
    }

    // Determines the actual lower limit based on whether the threshold is active
    getEffectiveMin(key) {
        return this.activeThresholds[key] ? Math.max(this.minValues[key], this.thresholds[key]) : this.minValues[key];
    }

    // Called when mousedown/touchstart occurs on a handle
    startDrag(key) {
        this.dragState = {
            activeKey: key,
            startValues: { ...this.values }
        };
    }

    // Called when mouseup/touchend occurs
    endDrag() {
        this.dragState = null;
    }

    // Called during mousemove/touchmove
    updateActiveValue(key, newValue) {
        if (!this.dragState || this.dragState.activeKey !== key) return;

        // Restrict new value to bounds (Effective Min to Total)
        newValue = Math.max(this.getEffectiveMin(key), Math.min(this.total, newValue));
        let requestedDelta = newValue - this.dragState.startValues[key];
        
        const passives = Object.keys(this.values).filter(k => k !== key);
        
        // Rule: Passive entities at their effective minimum value do not participate
        let activePassives = passives.filter(k => this.dragState.startValues[k] > this.getEffectiveMin(k) + 1e-4);

        if (requestedDelta > 0) {
            // Increasing active, decreasing passives
            if (activePassives.length === 0) {
                // Cannot increase further because no passives can be decreased
                newValue = this.dragState.startValues[key];
                requestedDelta = 0;
            } else {
                // Prevent requesting more than the passives can collectively absorb
                let maxIncrease = activePassives.reduce((sum, p) => sum + (this.dragState.startValues[p] - this.getEffectiveMin(p)), 0);
                if (requestedDelta > maxIncrease) {
                    requestedDelta = maxIncrease;
                    newValue = this.dragState.startValues[key] + requestedDelta;
                }
            }
        } else if (requestedDelta < 0) {
            // Decreasing active, increasing passives
            // If ALL passives are at minimum, they MUST wake up to absorb the distributed value,
            // otherwise the active entity would be completely frozen.
            if (activePassives.length === 0) {
                activePassives = [...passives];
            }
        }

        // Prepare passive components working state based strictly on drag start values
        let currentPassives = {};
        let totalPassiveStartValue = 0;
        for (let p of activePassives) {
            currentPassives[p] = this.dragState.startValues[p];
            totalPassiveStartValue += currentPassives[p];
        }

        // Calculate original proportions (weights) relative to active passives
        let weights = {};
        for (let p of activePassives) {
            weights[p] = currentPassives[p] / totalPassiveStartValue;
        }

        // amountToDistribute is the value passive elements need to absorb 
        // (- requestedDelta because if Active goes up, Passives go down)
        let amountToDistribute = -requestedDelta; 

        if (amountToDistribute < 0) {
            // Active is INCREASING, Passives are DECREASING (Waterfall calculation)
            let decreaseAmount = -amountToDistribute;
            let activePool = [...activePassives];
            let iterationLimit = 100; // Safety catch for float loops
            
            while (decreaseAmount > 1e-6 && activePool.length > 0 && iterationLimit-- > 0) {
                let poolWeight = activePool.reduce((sum, p) => sum + weights[p], 0);
                let minRatio = Infinity;
                let firstToMin = null;
                
                // Find if any passive hits its effective minimum before others
                for (let p of activePool) {
                    let shareWeight = weights[p] / poolWeight;
                    let availableAmount = currentPassives[p] - this.getEffectiveMin(p);
                    let ratio = availableAmount / shareWeight;
                    if (ratio < minRatio) {
                        minRatio = ratio;
                        firstToMin = p;
                    }
                }
                
                if (minRatio <= decreaseAmount + 1e-6) {
                    // firstToMin hits min. Drain it exactly to effective min and loop again.
                    let actualDecrease = minRatio;
                    for (let p of activePool) {
                        let shareWeight = weights[p] / poolWeight;
                        currentPassives[p] -= actualDecrease * shareWeight;
                        if (currentPassives[p] < this.getEffectiveMin(p) + 1e-6) currentPassives[p] = this.getEffectiveMin(p); // Float clamp
                    }
                    decreaseAmount -= actualDecrease;
                    activePool = activePool.filter(p => p !== firstToMin);
                } else {
                    // No elements hit min with remaining decrease. Distribute rest proportionally.
                    for (let p of activePool) {
                        let shareWeight = weights[p] / poolWeight;
                        currentPassives[p] -= decreaseAmount * shareWeight;
                    }
                    decreaseAmount = 0;
                }
            }
        } else if (amountToDistribute > 0) {
            // Active is DECREASING, Passives are INCREASING
            // No bounds to worry about, just standard distribution
            for (let p of activePassives) {
                currentPassives[p] += amountToDistribute * weights[p];
            }
        }

        // Apply mathematically verified values to state
        this.values[key] = newValue;
        for (let p of activePassives) {
            this.values[p] = currentPassives[p];
        }
        
        // Float precision corrector: Ensure perfect sum matches Total
        let sum = Object.values(this.values).reduce((a, b) => a + b, 0);
        let diff = this.total - sum;
        if (Math.abs(diff) > 1e-4) {
            // Apply precision correction to active key to avoid pushing passives below min
            this.values[key] += diff;
        }

        if (this.onChange) this.onChange(this.values);
    }
}

export class DistributorUI {
    constructor(containerIdOrElementOrDistributor, initialValues, minValues, thresholds, activeThresholds, colors) {
        if (typeof containerIdOrElementOrDistributor === 'string') {
            this.container = document.getElementById(containerIdOrElementOrDistributor);
            this.distributor = new ValueDistributor(100, initialValues, minValues, thresholds, activeThresholds, (newValues) => {
                this.updateUI(newValues);
            });
        } else if (containerIdOrElementOrDistributor instanceof HTMLElement) {
            this.container = containerIdOrElementOrDistributor;
            this.distributor = new ValueDistributor(100, initialValues, minValues, thresholds, activeThresholds, (newValues) => {
                this.updateUI(newValues);
            });
        } else {
            this.container = document.createElement('div');
            this.container.className = 'distributor-ui-wrapper w-full mt-3';
            this.distributor = containerIdOrElementOrDistributor;
            this.distributor.onChange = (newValues) => {
                this.updateUI(newValues);
            };
        }
        
        this.colors = colors || ['#6366f1', '#00e676', '#ff9800', '#00f2ff', '#ff0055'];
        this.trackElements = {};
        this.fillElements = {};
        this.handleElements = {};
        this.valueDisplays = {};
        this.dragState = null;
        this.isMounted = false;
        this._cachedValues = null;
        
        if (this.container && !(containerIdOrElementOrDistributor instanceof ValueDistributor)) {
            this.render(initialValues || this.distributor.values);
        }
    }

    render(values) {
        values = values || this.distributor.values;
        if (!this.container) return;
        this.container.innerHTML = '';
        const keys = Object.keys(values);

keys.forEach((key, index) => {
    const hexColor = this.colors[index % this.colors.length];
            
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 mb-4 last:mb-0 relative group w-full';
            
    const label = document.createElement('div');
    label.className = 'w-20 font-mono text-[10px] text-[var(--text-secondary)] uppercase tracking-widest truncate select-none';
    label.innerText = key.replace('_', ' ');

    const trackWrap = document.createElement('div');
    trackWrap.className = 'flex-1 h-1 bg-[var(--border)] rounded-full relative cursor-pointer group-hover:bg-[#3f3f46] transition-colors';
    this.trackElements[key] = trackWrap;

    const minMarker = document.createElement('div');
    minMarker.className = 'absolute top-1/2 -translate-y-1/2 w-[2px] h-2 bg-red-500/40 rounded-full z-0 pointer-events-none';
    const minPercent = (this.distributor.minValues[key] / this.distributor.total) * 100;
    minMarker.style.left = `${minPercent}%`;

    trackWrap.appendChild(minMarker);

    if (this.distributor.activeThresholds[key]) {
        const thrPercent = (this.distributor.thresholds[key] / this.distributor.total) * 100;
        const thrMarker = document.createElement('div');
        thrMarker.className = 'absolute top-1/2 -translate-y-1/2 w-[2px] h-2.5 bg-orange-500/60 rounded-full z-10 pointer-events-none';
        thrMarker.style.left = `${thrPercent}%`;
        trackWrap.appendChild(thrMarker);
    }

    const fill = document.createElement('div');
    fill.className = `absolute top-0 left-0 h-full rounded-full z-10 pointer-events-none transition-none`;
    fill.style.backgroundColor = hexColor;
    fill.style.opacity = '0.9';
    this.fillElements[key] = fill;

    const handle = document.createElement('div');
    handle.className = 'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full cursor-ew-resize z-20 shadow-[0_0_8px_rgba(0,0,0,0.8)] border-2 border-[var(--bg-main)] hover:scale-125 transition-transform';
            
    handle.addEventListener('mousedown', (e) => this.handleDragStart(e, key));
    handle.addEventListener('touchstart', (e) => this.handleDragStart(e, key), { passive: false });
    this.handleElements[key] = handle;

    const valDisplay = document.createElement('div');
    valDisplay.className = 'w-10 text-right font-mono text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors select-none';
    this.valueDisplays[key] = valDisplay;

    trackWrap.appendChild(fill);
    trackWrap.appendChild(handle);
            
    row.appendChild(label);
    row.appendChild(trackWrap);
    row.appendChild(valDisplay);
            
    this.container.appendChild(row);
});
        
this.isMounted = true;
        this.updateUI(this._cachedValues || values);
        return this.container;
    }

    handleDragStart(e, key) {
        e.preventDefault(); // Prevent text selection/scrolling
        document.body.classList.add('dragging');
        
        this.distributor.startDrag(key);
        this.dragState = {
            key: key,
            trackRect: this.trackElements[key].getBoundingClientRect()
        };

        const moveHandler = (evt) => this.handleDragMove(evt);
        const upHandler = (evt) => {
            this.handleDragEnd(evt);
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('touchmove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
            window.removeEventListener('touchend', upHandler);
        };

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchend', upHandler);
    }

    handleDragMove(e) {
        if (!this.dragState) return;
        
        if (e.type.includes('touch')) {
            e.preventDefault(); // crucial to prevent page scrolling on mobile
        }
        
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const rect = this.dragState.trackRect;
        
        let percentage = (clientX - rect.left) / rect.width;
        percentage = Math.max(0, Math.min(1, percentage)); // Clamp between 0 and 1
        
        const newValue = percentage * this.distributor.total;
        this.distributor.updateActiveValue(this.dragState.key, newValue);
    }

    handleDragEnd(e) {
        document.body.classList.remove('dragging');
        this.distributor.endDrag();
        this.dragState = null;
    }

    updateUI(values) {
        if (!this.isMounted) {
            this._cachedValues = values;
            return;
        }
        values = values || (this.distributor && this.distributor.values) || {};
        const keys = Object.keys(values);

        keys.forEach(key => {
            const val = values[key];
            const percent = (val / this.distributor.total) * 100;
                
            this.fillElements[key].style.width = `${percent}%`;
            this.handleElements[key].style.left = `${percent}%`;
            this.valueDisplays[key].innerText = `${val.toFixed(1)}%`;
        });
    }
}