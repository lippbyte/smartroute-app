# Uji cold start Dev Client di HP Android lewat USB. Belum pernah dijalankan pada perangkat.
#
#   powershell -File scripts/cold-start-check.ps1 [-Runs 10] [-Out hasil.csv]
#
# Syarat: HP tersambung USB dengan USB debugging menyala, Dev Client terpasang, dan Metro
# hidup di alamat -Url. Setiap putaran: paksa berhenti, bersihkan logcat, buka app ke Metro,
# lalu tunggu app berjalan atau galat. Hanya status dan waktu yang dicatat, bukan isi log.
param(
  [int]$Runs = 10,
  [string]$Url = "https://a3c0lx4-lippbyte-8081.exp.direct",
  [string]$Package = "com.inouerakan.smartroute",
  [int]$TimeoutSec = 90,
  [int]$SettleSec = 8,
  [string]$Out = "cold-start.csv"
)

$adb = (Get-Command adb -ErrorAction SilentlyContinue).Source
if (-not $adb) { $adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe" }
if (-not (Test-Path $adb)) { Write-Output "GAGAL  adb tidak ditemukan"; exit 2 }

$devices = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" })
if ($devices.Count -ne 1) { Write-Output "GAGAL  butuh tepat satu HP tersambung, ditemukan $($devices.Count)"; exit 2 }
if (-not (& $adb shell pm list packages $Package | Select-String -SimpleMatch $Package)) { Write-Output "GAGAL  $Package tidak terpasang"; exit 2 }

$FAILURE = "EventEmitter|runtime not ready|FATAL EXCEPTION|Unable to load script"
$READY = 'Running "main"'
$deepLink = "smartroute://expo-development-client/?url=" + [uri]::EscapeDataString($Url)
$rows = @()

for ($i = 1; $i -le $Runs; $i++) {
  & $adb shell am force-stop $Package | Out-Null
  Start-Sleep -Seconds 2
  & $adb logcat -c | Out-Null
  $timer = [Diagnostics.Stopwatch]::StartNew()
  & $adb shell am start -a android.intent.action.VIEW -d "`"$deepLink`"" $Package | Out-Null

  $status = "TIMEOUT"
  $seconds = ""
  while ($timer.Elapsed.TotalSeconds -lt $TimeoutSec) {
    $log = (& $adb logcat -d) -join "`n"
    if ($log -match $FAILURE) { $status = "GALAT"; $seconds = [math]::Round($timer.Elapsed.TotalSeconds, 1); break }
    if ($log.Contains($READY)) { $status = "OK"; $seconds = [math]::Round($timer.Elapsed.TotalSeconds, 1); break }
    Start-Sleep -Milliseconds 700
  }
  # Galat bisa muncul sesaat sesudah app berjalan.
  if ($status -eq "OK") {
    Start-Sleep -Seconds $SettleSec
    if (((& $adb logcat -d) -join "`n") -match $FAILURE) { $status = "GALAT-SESUDAH" }
  }
  $rows += [pscustomobject]@{ Putaran = $i; Jam = (Get-Date).ToString("HH:mm:ss"); Status = $status; Detik = $seconds }
  Write-Output ("{0,2}  {1,-14} {2} dtk" -f $i, $status, $seconds)
}

$rows | Export-Csv -NoTypeInformation -Encoding UTF8 $Out
$ok = @($rows | Where-Object { $_.Status -eq "OK" }).Count
Write-Output "`n$ok dari $Runs cold start berhasil. Hasil: $Out"
if ($ok -ne $Runs) { exit 1 }
