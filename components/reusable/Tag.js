/**
 * Omni-Causal Tag Colorizer
 * Handles deterministic color generation, semantic clustering, and S³ contrast logic.
 */
export class TagColorizer {
    static clusters = [];

    static setClusters(data) {
        this.clusters = data || [];
    }

    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }

    static extractRoot(str) {
        const normalized = str.trim().toLowerCase();
        const clusterMatch = this.clusters.find(c => 
            c.members.some(m => m.toLowerCase() === normalized) || c.canonical.toLowerCase() === normalized
        );
        if (clusterMatch) return `CLUSTER:${clusterMatch.id}`;
        const match = normalized.match(/^[a-z0-9]+/);
        return match ? match[0] : normalized;
    }

    static calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        if (s1 === s2) return 1.0;

        const root1 = this.extractRoot(s1);
        const root2 = this.extractRoot(s2);
        if (root1 === root2) return 0.98;

        const m = Array.from({ length: s2.length + 1 }, (_, i) => [i]);
        for (let j = 1; j <= s1.length; j++) m[0][j] = j;
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                m[i][j] = s2[i-1] === s1[j-1] ? m[i-1][j-1] : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
            }
        }
        return 1 - (m[s2.length][s1.length] / Math.max(s1.length, s2.length));
    }

    static hslToRgb(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [255 * f(0), 255 * f(8), 255 * f(4)];
    }

    static getLuminance(r, g, b) {
        const parts = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
    }

    static getTagStyle(tag) {
        const cleanTag = tag.trim();
        const root = this.extractRoot(cleanTag);
        
        let hue;
        if (root.startsWith('CLUSTER:')) {
            const cid = root.split(':')[1];
            const cluster = this.clusters.find(c => c.id === cid);
            hue = cluster?.recommended_hue ?? (this.hashString(cid) % 360);
        } else {
            hue = this.hashString(root) % 360;
        }

        const fullHash = this.hashString(cleanTag.toLowerCase());
        const sat = 65 + (fullHash % 25); 
        const light = 45 + ((fullHash >> 4) % 15);

        const [r, g, b] = this.hslToRgb(hue, sat, light);
        const textColor = this.getLuminance(r, g, b) > 0.4 ? '#000000' : '#ffffff';
        
        return { 
            backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)`, 
            color: textColor, 
            rootName: root.replace('CLUSTER:', '◈ '),
            hue, saturation: sat, lightness: light
        };
    }
}

/**
 * Omni-Causal Tag Entity
 * Encapsulates physical dimensions, reactive bindings, and empathic resonance.
 * Assumes a Tailwind CSS environment for styling.
 */
export class Tag {
    constructor({ content, data = {}, display = null, size = 3, track_similar = false, container }) {
        this.content = content;
        this.container = container;
        this.track_similar = track_similar;
        
        // S³ Dimensional Scaling (Retracted ~0.8x)
        const sizeMap = {
            1: 'text-xs px-1.5 py-0.5', // tiny
            2: 'text-sm px-2 py-1',     // small
            3: 'text-base px-3 py-1.5', // average
            4: 'text-lg px-4 py-2',     // big
            5: 'text-xl px-5 py-3'      // giant
        };
        
        const sizeKey = typeof size === 'string' ? 
            { 'tiny':1, 'small':2, 'average':3, 'big':4, 'giant':5 }[size.toLowerCase()] || 3 : 
            size;
        
        this.sizeClass = sizeMap[sizeKey] || sizeMap[3];
        this.rawSize = sizeKey;
        
        // Quantum Entanglement: Proxy Data Intercept
        this._data = new Proxy(data, {
            set: (target, property, value) => {
                target[property] = value;
                this.updateDisplay(); // Trigger wave collapse
                return true;
            }
        });
        
        this._display = display;
        
        // Dom Manifestation
        this.el = document.createElement('div');
        this.el.tagInstance = this; 
        
        this.initDOM();
        this.attachResonanceEvents();
        if (this.container) this.container.appendChild(this.el);
    }

    get data() { return this._data; }
    get display() { return this._display; }
    
    set display(val) { 
        this._display = val; 
        this.updateDisplay(); 
    }

    initDOM() {
        const style = TagColorizer.getTagStyle(this.content);
        // leading-none + items-center for horizontal symmetry
        this.el.className = `${this.sizeClass} rounded-lg font-bold tag-transition shadow-lg flex items-center gap-2 cursor-pointer border border-black/10 select-none inline-flex relative leading-none`;
        this.el.style.backgroundColor = style.backgroundColor;
        this.el.style.color = style.color;
        this.el.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        this.contentSpan = document.createElement('span');
        this.contentSpan.className = 'flex items-center h-full';
        this.contentSpan.textContent = this.content;
        
        // Display boundary
        this.displaySpan = document.createElement('span');
        // translate-y-[1px] corrects monospaced baseline drift
        this.displaySpan.className = 'font-mono opacity-90 border-l border-current pl-2 ml-1 text-[0.9em] flex items-center leading-none self-center translate-y-[1px] h-full';
        
        this.el.appendChild(this.contentSpan);
        this.el.appendChild(this.displaySpan);
        
        this.updateDisplay();
    }

    updateDisplay() {
        if (!this._display) {
            this.displaySpan.style.display = 'none';
            return;
        }
        
        this.displaySpan.style.display = 'flex';
        
        if (typeof this._display === 'function') {
            this._display(this);
        }
        
        if (typeof this._display === 'string' && this._display !== '') {
            if (this._display in this._data) {
                this.displaySpan.textContent = String(this._data[this._display]);
            } else {
                this.displaySpan.textContent = this._display;
            }
        }
    }

    attachResonanceEvents() {
        this.el.addEventListener('mouseenter', () => {
            if (!this.track_similar || !this.container) return;
            
            const siblings = Array.from(this.container.children);
            siblings.forEach(sibling => {
                if (sibling.tagInstance) {
                    const sim = TagColorizer.calculateSimilarity(this.content, sibling.tagInstance.content);
                    sibling.style.opacity = Math.max(0.2, sim).toFixed(2);
                    if (sim === 1.0) {
                        sibling.style.zIndex = '20';
                        sibling.style.transform = `scale(1.03)`;
                    } else {
                        sibling.style.zIndex = '1';
                        sibling.style.transform = 'scale(1)';
                    }
                }
            });
        });
        
        this.el.addEventListener('mouseleave', () => {
            if (!this.track_similar || !this.container) return;
            
            const siblings = Array.from(this.container.children);
            siblings.forEach(sibling => {
                sibling.style.opacity = '1';
                sibling.style.zIndex = '1';
                sibling.style.transform = ''; 
            });
        });
    }
}