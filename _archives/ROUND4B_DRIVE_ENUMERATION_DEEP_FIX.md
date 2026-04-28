# DCC Round 4B - Drive Enumeration Deep Fix

This patch fixes the drive list not loading by replacing the single/fallback enumeration path with a provider chain:

1. `Get-CimInstance Win32_LogicalDisk`
2. `.NET System.IO.DriveInfo.GetDrives()`
3. `Get-PSDrive -PSProvider FileSystem`
4. direct Node drive-root scan from `A:\` through `Z:\`

The renderer now handles both array and object-shaped drive responses, updates the target safety UI even when no drives are returned, and diagnostics include the provider attempts used during drive enumeration.

If drives still do not appear, open STATUS and copy diagnostics. The `driveEnumeration` section will show which provider failed and why.
