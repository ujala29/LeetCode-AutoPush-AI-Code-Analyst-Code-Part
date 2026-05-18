// utils/auth.js — chrome.identity wrappers (promisified)

export function signIn() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

// Returns token or null (no popup — silent only)
export function getToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      resolve(chrome.runtime.lastError || !token ? null : token);
    });
  });
}

// Remove stale token from Chrome's cache, then get a fresh one silently
export function refreshToken(expiredToken) {
  return new Promise((resolve, reject) => {
    chrome.identity.removeCachedAuthToken({ token: expiredToken }, () => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) reject(new Error('Token refresh failed — user must sign in again'));
        else resolve(token);
      });
    });
  });
}

export function signOut(token) {
  return new Promise((resolve) => {
    if (!token) { resolve(); return; }
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// Fetch the signed-in user's Google profile (name, email, picture)
export async function getUserProfile(token) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
