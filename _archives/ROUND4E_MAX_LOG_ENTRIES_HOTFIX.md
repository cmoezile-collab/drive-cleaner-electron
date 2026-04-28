# DCC Round 4E - MAX_LOG_ENTRIES Hotfix

Fixes the runtime error:

```text
MAX_LOG_ENTRIES is not defined
```

Round 4 introduced visible log capping in `appendLog()`, but the renderer constant was missing. Since `refreshDrives()` logs before/after drive enumeration, the missing constant made drive refresh fail even though STATUS diagnostics could already see the drives.

## Apply

From the DCC project root:

```bat
node apply_round4E_log_constant_hotfix.js
npm test
npm start
```

Or double-click:

```bat
apply_round4E_log_constant_hotfix.bat
```

Then click **Refresh Drives**. The drive dropdown should populate.
