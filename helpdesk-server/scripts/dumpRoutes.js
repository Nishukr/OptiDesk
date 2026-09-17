// scripts/dumpRoutes.js — print every route the current code registers.
// Diagnostic only: proves whether a 404 is a missing route or a stale process.
//   node scripts/dumpRoutes.js
require('dotenv').config();
const app = require('../app');

const rows = [];

function mountPath(layer) {
  // Express stores the mount as a regexp like /^\/api\/tickets\/?(?=\/|$)/i
  const src = (layer.regexp && layer.regexp.source) || '';
  if (src === '^\\/?(?=\\/|$)') return '';
  return src
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\$$/, '')
    .replace(/\\\//g, '/');
}

function walk(stack, prefix) {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase())
        .join(',');
      rows.push(`${methods.padEnd(7)} ${prefix}${layer.route.path}`);
    } else if (layer.handle && layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer));
    }
  }
}

walk(app._router.stack, '');
console.log(rows.join('\n'));
console.log(`\n${rows.length} routes registered.`);
