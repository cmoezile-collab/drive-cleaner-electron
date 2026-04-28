# DCC Round 4A - Drive Loading Hotfix

Fixes a drive enumeration blind spot from Round 4.

Changes:
- Adds a PowerShell `Get-PSDrive` fallback if CIM drive enumeration fails or returns empty.
- Stops silently swallowing startup drive-load failures.
- Surfaces `driveLoadError` in startup logs and diagnostics.
- Makes Refresh Drives report an explicit no-drives state.

If no drives still load after this patch, open STATUS and copy the diagnostics report.
