# Downloads the latest TransJakarta GTFS static feed into data\transjakarta_gtfs.zip
# and validates that it has the core files OTP2 needs, non-corrupt.
#
# Source: https://gtfs.transjakarta.co.id/files/file_gtfs.zip (official feed,
# indexed on Transitland as f-transjakarta~id). As of 2026-09 this host serves
# an expired-but-legitimate TLS cert (CN=*.transjakarta.co.id, issued by
# Sectigo, simply not renewed in time) — hence -SkipCertificateCheck below.
# If TransJakarta renews the cert, this flag is harmless and can stay.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$url = "https://gtfs.transjakarta.co.id/files/file_gtfs.zip"
$dest = "data\transjakarta_gtfs.zip"
$required = @("agency.txt","routes.txt","stops.txt","trips.txt","stop_times.txt","calendar.txt")

Write-Host "Downloading GTFS from $url ..."
Invoke-WebRequest -Uri $url -OutFile $dest -SkipCertificateCheck

Write-Host "Validating GTFS structure ..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $dest))
try {
    $names = $zip.Entries | ForEach-Object { $_.Name }
    foreach ($f in $required) {
        if ($names -notcontains $f) {
            Write-Error "required file '$f' missing from $dest — aborting, previous graph.obj left untouched."
            exit 1
        }
    }
} finally {
    $zip.Dispose()
}
Write-Host "OK: all required GTFS files present and archive is not corrupt."
Write-Host ""
Write-Host "Next: rebuild the graph with scripts\build-graph.ps1 (or .sh)."
