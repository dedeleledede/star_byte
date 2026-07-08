# Desktop Memory Measurement

Do not compare one visible process on Windows to only the Tauri parent process on Linux. Measure the whole process tree.

## Linux

Use RSS and PSS when available:

```bash
pid="$(pgrep -n app || pgrep -n star_byte)"
pstree -ap "$pid"
ps -o pid,ppid,rss,comm --forest --ppid "$pid"
smem -P 'app|WebKitWebProcess|NetworkProcess' -k
```

If `smem` is unavailable:

```bash
for child in "$pid" $(pgrep -P "$pid"); do
  grep -E '^(Name|VmRSS|Pss):' /proc "$child"/smaps_rollup 2>/dev/null
done
```

Measure both:

- Arch native package using system WebKitGTK.
- AppImage, if it starts successfully.

## Windows

Use PowerShell to sum the process tree working set:

```powershell
$root = Get-Process star_byte -ErrorAction Stop | Select-Object -First 1
$all = Get-CimInstance Win32_Process
$tree = @($root.Id)
$queue = @($root.Id)
while ($queue.Count -gt 0) {
  $parent = $queue[0]
  $queue = $queue[1..($queue.Count - 1)]
  $children = $all | Where-Object { $_.ParentProcessId -eq $parent }
  foreach ($child in $children) {
    $tree += $child.ProcessId
    $queue += $child.ProcessId
  }
}
Get-Process -Id $tree | Select-Object Id,ProcessName,WorkingSet64
($tree | ForEach-Object { (Get-Process -Id $_).WorkingSet64 } | Measure-Object -Sum).Sum / 1MB
```

Include WebView2 subprocesses in the total.

## Results Table

Fill this during release validation:

| Platform/package | Metric | Total RAM | Notes |
| --- | --- | ---: | --- |
| Windows NSIS | Process tree working set | TBD | Include WebView2 children |
| Arch native package | RSS/PSS tree | TBD | Uses system `webkit2gtk-4.1` |
| Arch AppImage | RSS/PSS tree | TBD | Only if AppImage starts |

## PWA/Service Worker Check

`PwaPrompt` is gated out of Tauri in `apps/web/src/App.tsx`, and `vite.config.ts` disables VitePWA when `mode === "desktop-production"`. During memory work, verify the desktop build still has no service worker output:

```bash
rg -n "serviceWorker|virtual:pwa-register|PwaPrompt" apps/web/src apps/web/dist
```

If service worker registration reappears in Tauri desktop builds and contributes measurable overhead, keep it disabled for `mode === "desktop-production"` and compare memory again.
