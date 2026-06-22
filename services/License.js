/**
 * @file services/License.js
 * @purpose Sovereign tier authority — local-crypto lifetime license (ECDSA P-256 / SHA-256,
 *          verified in-browser via WebCrypto). No server. Routed through the Storage service
 *          (NOT raw chrome.storage). Exposes window.License. isPremium() is the SINGLE source
 *          of truth consumed by every premium gate.
 * @note    constants.js was not part of the provided substrate, so the license constants are
 *          embedded here (self-contained). Replace LICENSE_PUBLIC_KEY_B64 with your real key.
 */
import { Storage } from './Storage.js';
import { State } from './State.js';
import { log } from '../utils/logger.js';

// One-time keypair (developer machine, offline):
//   openssl ecparam -name prime256v1 -genkey -noout -out private_key.pem
//   openssl ec -in private_key.pem -pubout -outform DER | base64   ← paste result below
export const LICENSE_PUBLIC_KEY_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEb2OmQan61m+k+C1+oS+9t2CMMksbbzCTuX+myiZ717DZky78YrGo4z2vcmPkjdpKl+DjSVs3KaysT/fD7j5Rjg==';
export const LICENSE_PREFIX  = 'ALCH-';
export const LICENSE_PRODUCT = 'alchimist';
export const LICENSE_TIER    = 'lifetime';

const KEYS = {
    STATUS: 'license_status',
    EMAIL:  'license_email',
    HASH:   'license_key_hash',
    AT:     'license_activated_at'
};

class LicenseService {
    constructor() {
        this._publicKey = null;
        this._keyPromise = null;
    }

    // Boot hydration — call BEFORE any component mounts so gates never flash unlocked.
    async init() {
        const status = (await Storage.get(KEYS.STATUS)) || 'free';
        State.set('license_status', status);
        this._getPublicKey().catch(() => {}); // warm crypto cache; ignore until a key is pasted
        log('LOGIC', 'LICENSE_INIT', { status });
        return status;
    }

    // SINGLE gate authority. Absence safe-fails to 'free'.
    isPremium() {
        return (State.get('license_status') || 'free') === 'premium';
    }

    _b64urlToBytes(b64url) {
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    async _getPublicKey() {
        if (this._publicKey) return this._publicKey;
        if (!this._keyPromise) {
            const raw = this._b64urlToBytes(LICENSE_PUBLIC_KEY_B64.replace(/=+$/, ''));
            this._keyPromise = crypto.subtle.importKey(
                'spki', raw.buffer,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false, ['verify']
            ).then(k => (this._publicKey = k));
        }
        return this._keyPromise;
    }

    // Returns { valid:boolean, reason?:TOKEN }. Signature is RAW IEEE-P1363 r‖s (64 bytes) —
    // generate_license.py emits raw, NOT DER. WebCrypto rejects DER, so the generator must match.
    async validate(email, key) {
        if (!key || !key.startsWith(LICENSE_PREFIX)) return { valid: false, reason: 'ERR_LICENSE_FORMAT' };
        if (!email || !email.includes('@'))          return { valid: false, reason: 'ERR_LICENSE_EMPTY_EMAIL' };
        let sig;
        try { sig = this._b64urlToBytes(key.slice(LICENSE_PREFIX.length)); }
        catch { return { valid: false, reason: 'ERR_LICENSE_FORMAT' }; }
        const payload = new TextEncoder().encode(`${email.toLowerCase().trim()}:alchimist:lifetime`);
        try {
            const pub = await this._getPublicKey();
            const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig.buffer, payload.buffer);
            log('LOGIC', 'LICENSE_VALIDATE', { valid: ok });
            return ok ? { valid: true } : { valid: false, reason: 'ERR_LICENSE_MISMATCH' };
        } catch {
            return { valid: false, reason: 'ERR_LICENSE_CRYPTO' };
        }
    }

    async _sha256Hex(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async activate(email, rawKey) {
        if (this.isPremium()) return { valid: false, reason: 'MSG_LICENSE_ALREADY_ACTIVE' };
        const res = await this.validate(email, rawKey);
        if (!res.valid) return res;
        const hash = await this._sha256Hex(rawKey); // raw key is NEVER persisted
        await Storage.set({
            [KEYS.STATUS]: 'premium',
            [KEYS.EMAIL]:  email.toLowerCase().trim(),
            [KEYS.HASH]:   hash,
            [KEYS.AT]:     Date.now()
        });
        State.set('license_status', 'premium');
        window.dispatchEvent(new CustomEvent('LICENSE_STATUS_CHANGED', { detail: { status: 'premium' } }));
        log('DATA', 'LICENSE_ACTIVATED', {});
        return { valid: true };
    }

    async revoke() {
        // Set 'free' explicitly and strip the rest — avoids any remove/re-seed race.
        await Storage.set({ [KEYS.STATUS]: 'free' });
        await Storage.remove([KEYS.EMAIL, KEYS.HASH, KEYS.AT]);
        State.set('license_status', 'free');
        window.dispatchEvent(new CustomEvent('LICENSE_STATUS_CHANGED', { detail: { status: 'free' } }));
        log('DATA', 'LICENSE_REVOKED', {});
    }

    async getInfo() {
        return {
            status:      (await Storage.get(KEYS.STATUS)) || 'free',
            email:       await Storage.get(KEYS.EMAIL),
            activatedAt: await Storage.get(KEYS.AT)
        };
    }
}

export const License = new LicenseService();
window.License = License; // debug/test global per architecture rule
