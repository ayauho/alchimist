/**
 * @file modules/ArchiveResonance.js
 * @purpose ULTRA-DENSE Archival layer using LZMA.
 */
import { log } from '../utils/logger.js';
import { LZMA } from '../libs/lzma_worker.js';

export const ArchiveResonance = {
  async compress(data) {
    return new Promise((resolve, reject) => {
      if (typeof LZMA === 'undefined' || !LZMA.compress) {
        log('e', 'ARCHIVE_FATAL', 'LZMA Substrate Missing at runtime');
        return reject(new Error("LZMA_NOT_FOUND"));
      }
      try {
        const jsonString = JSON.stringify(data);
        const compressionLevel = 4; // Balanced ratio/speed
        // [V18.7-TEMP] Instrumentation gate: measure actual LZMA cost to confirm it is
        // the dominant preset-apply bottleneck before committing FIX-1. REMOVE after measuring.
        const _t0 = performance.now();
        LZMA.compress(jsonString, compressionLevel, (result, error) => {
          log('DATA', 'COMPRESS_TIMING', { ms: Math.round(performance.now() - _t0), bytes: jsonString.length });
          if (error) return reject(error);
          const uint8 = new Uint8Array(result);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          resolve(btoa(binary));
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async decompress(base64Data) {
    return new Promise((resolve, reject) => {
      if (typeof LZMA === 'undefined' || !LZMA.decompress) {
        log('e', 'ARCHIVE_FATAL', 'LZMA Substrate Missing at runtime');
        return reject(new Error("LZMA_NOT_FOUND"));
      }
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        LZMA.decompress(bytes, (result, error) => {
          if (error) return reject(error);
          resolve(JSON.parse(result));
        });
      } catch (error) {
        resolve(null);
      }
    });
  }
};
