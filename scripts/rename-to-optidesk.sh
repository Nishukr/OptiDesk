#!/usr/bin/env bash
# scripts/rename-to-optidesk.sh — finish the "helpdesk" → "OptiDesk" rename.
#
# WHY THIS IS A SCRIPT AND NOT ALREADY DONE:
# renaming the two folders needs them to be unlocked, and Windows refuses while
# `npm run dev` / nodemon is running out of them ("Permission denied"). Everything
# else — package names, titles, branding, the health endpoint — is already renamed.
#
# HOW TO RUN (from the repo root, with both dev servers stopped):
#   bash scripts/rename-to-optidesk.sh
#
# Afterwards start the servers from the new paths:
#   npm --prefix optidesk-server run dev
#   npm --prefix optidesk-client run dev
set -euo pipefail

cd "$(dirname "$0")/.."
echo "Working in: $(pwd)"

# ---- 1. move the folders (git mv keeps history) --------------------------
for pair in "helpdesk-server optidesk-server" "helpdesk-client optidesk-client"; do
  set -- $pair
  if [ -d "$1" ]; then
    echo "→ $1  ⇒  $2"
    git mv "$1" "$2"
  elif [ -d "$2" ]; then
    echo "✓ $2 already renamed"
  else
    echo "!! neither $1 nor $2 found — nothing to do"
  fi
done

# ---- 2. fix the paths written inside tracked text files ------------------
# Only the folder names are rewritten; product branding is already "OptiDesk".
echo "→ rewriting folder references in tracked files"
git ls-files -z -- '*.md' '*.js' '*.jsx' '*.json' '*.html' \
  | xargs -0 grep -lZ -E 'helpdesk-(server|client)' 2>/dev/null \
  | xargs -0 -r sed -i -e 's/helpdesk-server/optidesk-server/g' -e 's/helpdesk-client/optidesk-client/g'

# ---- 3. the Browser-preview launch config lives outside git ls-files ------
if [ -f .claude/launch.json ]; then
  sed -i -e 's/helpdesk-client/optidesk-client/g' .claude/launch.json
  echo "→ updated .claude/launch.json"
fi

echo
echo "✅ Rename complete. Remaining matches (should only be prose, if any):"
grep -rn --exclude-dir=node_modules --exclude-dir=.git -iE 'helpdesk' . || echo "   (none)"
echo
echo "Next:  npm --prefix optidesk-server run dev"
echo "       npm --prefix optidesk-client run dev"
