/* =========================================================
   infra/crypto.js — رمزنگاری با Web Crypto API
   ========================================================= */
window.App = window.App || {};

App.Crypto = (function () {
  const enc = new TextEncoder();

  const bytesToB64 = (bytes) => {
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  };
  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };
  const bytesToHex = (bytes) =>
    Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

  /* PBKDF2 + SHA-256 */
  async function hashPassword(password, saltB64, iterations) {
    iterations = iterations || 100000;
    const salt = saltB64 ? b64ToBytes(saltB64) : randomBytes(16);

    const key = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key, 256
    );

    return {
      hash: bytesToB64(new Uint8Array(bits)),
      salt: bytesToB64(salt),
      iterations
    };
  }

  function constantTimeEq(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  async function verifyPassword(password, stored) {
    try {
      const r = await hashPassword(password, stored.salt, stored.iterations);
      return constantTimeEq(r.hash, stored.hash);
    } catch { return false; }
  }

  const randomToken = (n) => bytesToHex(randomBytes(n || 32));

  return { hashPassword, verifyPassword, randomToken, bytesToB64, b64ToBytes, bytesToHex };
})();