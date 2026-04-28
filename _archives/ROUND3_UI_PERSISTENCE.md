# DCC Round 3 - UI Normalization + Preference Persistence

This pass adds a target command banner, keyboard shortcuts, focus/reduced-motion polish, safer disabled-action explanations, and local persistence for non-destructive UI preferences.

Manual checks:
- Change clean/scan toggles, filesystem, format type, and label, then restart DCC.
- Confirm the selected tab persists.
- Select C: and verify the target banner says scan-only.
- Select a removable drive and verify allowed actions update.
- Use Ctrl+1 and Ctrl+2 to switch Clean/Format.
- Confirm disabled action buttons explain why via hover title.
