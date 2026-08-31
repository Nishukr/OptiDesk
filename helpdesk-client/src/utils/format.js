// src/utils/format.js — tiny display helpers shared by the admin screens
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');

// "Nishu Kumar" -> "NK", falls back to the email's first letter
export const initials = (nameOrEmail = '?') =>
  nameOrEmail
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export const statusLabel = (s = '') => s.replace('_', ' ');
