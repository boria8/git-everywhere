$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"

Write-Host "=== TypeScript check ===" -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "TSC FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "TSC passed" -ForegroundColor Green

Write-Host "`n=== esbuild ===" -ForegroundColor Cyan
node esbuild.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "esbuild FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== vitest ===" -ForegroundColor Cyan
npx vitest run
if ($LASTEXITCODE -ne 0) {
    Write-Host "vitest FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nAll checks passed!" -ForegroundColor Green
