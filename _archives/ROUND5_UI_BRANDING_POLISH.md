# DCC Round 5 — UI + Branding Polish

This pass normalizes Drive Cleaner by Clark after the safety and drive-loading fixes.

## Changes
- Moves Clean / Format navigation into the left sidebar so the workspace feels more like the VDC/NEXUS product family.
- Uses the actual DCC icon in the titlebar instead of a text-only badge.
- Removes the now-unused top tab row from the main content grid.
- Tightens titlebar typography, card shadows, button weight, and target-banner polish.
- Expands the audit checks to catch the sidebar navigation and titlebar branding.

## Scope
No safety policy changes. No destructive-operation behavior changes. This is a UI/branding normalization pass only.

## Test
Run:

```bat
npm test
npm start
```

Manual check:
1. Confirm drives still load.
2. Use sidebar Clean / Format navigation.
3. Confirm C: remains scan-only.
4. Confirm fixed non-system drives still block formatting.
5. Confirm removable drives still show guarded format as available.
6. Confirm Copy Active Log still works.
