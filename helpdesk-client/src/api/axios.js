// src/api/axios.js — one axios instance, two kinds of credential.
//
// OptiDesk has two independent sign-ins and the request path is what decides
// which one to present:
//
//   /api/auth/*    staff password sign-in + email verification  → JWT (localStorage)
//   /api/admin/*   the staff board, triage, resolution, directory → JWT (localStorage)
//   everything else (/api/tickets, /api/chat, /api/me)          → Clerk session token
//
// The two URL spaces are deliberately disjoint so this choice can be made from
// the path alone, with no per-call flag to forget. Keep them that way: moving a
// staff endpoint out from under /admin would silently start sending it a
// customer's Clerk token.
import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api',
});

// Filled in by <ClerkTokenBridge> once Clerk has loaded. It stays null when Clerk
// is unconfigured or nobody is signed in, in which case customer requests go out
// unauthenticated and the server answers 401/503 with an explanation.
let clerkTokenGetter = null;

/** Called once at mount by the bridge. Pass null on unmount to stop using a stale getter. */
export function setClerkTokenGetter(fn) {
  clerkTokenGetter = typeof fn === 'function' ? fn : null;
}

// Requests that belong to the staff JWT. Anything not matching here is a
// customer request. axios gives `config.url` relative to baseURL, and callers
// are inconsistent about the leading slash, so normalise before testing.
const STAFF_PATH = /^\/(admin|auth)(\/|$)/;
const isStaffPath = (url = '') => STAFF_PATH.test(url.startsWith('/') ? url : `/${url}`);

api.interceptors.request.use(async (config) => {
  if (isStaffPath(config.url)) {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  // Customer route. getToken() refreshes a session that is about to expire, so
  // it must be awaited per request rather than cached at sign-in.
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Clerk could not mint a token (offline, session revoked). Send the request
      // bare and let the 401 handler below deal with it.
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only a rejected STAFF token may clear localStorage. A customer's 401 says
    // nothing about the staff session, and clearing it here would sign an admin
    // out of their own board the moment any customer request failed.
    if (err.response?.status === 401 && isStaffPath(err.config?.url)) {
      localStorage.removeItem('token');
    }
    return Promise.reject(err);
  }
);

export default api;
