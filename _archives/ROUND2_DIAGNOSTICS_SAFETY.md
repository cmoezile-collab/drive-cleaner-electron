# DCC Round 2 - Diagnostics + Target Safety

This patch adds:

- STATUS diagnostics modal with copyable report.
- Drive risk summary under the target selector.
- UI action gating for system/network/optical targets.
- Exact typed drive-ID challenge before formatting starts.
- Trusted clipboard write IPC for copying diagnostics.
- Main-process diagnostics route with runtime/security/safety snapshot.
- Audit coverage for the new guardrails.

Manual smoke test:

1. Run npm test.
2. Launch DCC as admin.
3. Select C: and confirm Unhide/Full Clean/Format are disabled while scan remains allowed.
4. Open STATUS and copy the report.
5. Select a removable test drive and confirm format asks you to type the drive ID exactly.
6. Cancel both confirmations before any real format unless you are using disposable media.
