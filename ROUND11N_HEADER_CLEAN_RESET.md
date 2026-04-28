# DCC Round 11N - Header Clean Reset

This patch cleans up the experimental header/logo fixes from Round 11K, 11L, and 11M.

It does three things:

1. Removes the runtime logo injector from `renderer.js`.
2. Removes the broad header CSS blocks that caused the titlebar text to squash and clip.
3. Applies a minimal logo-only fix using `assets/dcc-logo-32.png` so the original titlebar layout can breathe again.

Run from the DCC project root:

```bat
node apply_round11N_header_clean_reset.js
npm run test:rc
npm run start
```

If the logo is still not aligned after this, send `index.html` and `styles.css`. At that point the selector needs to be patched directly instead of through a generic hotfix.
