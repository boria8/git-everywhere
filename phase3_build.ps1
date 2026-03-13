$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"

Write-Host "=== Step 1: TypeScript type check ===" -ForegroundColor Cyan
npx tsc --noEmit
$tscExit = $LASTEXITCODE
Write-Host "tsc exit code: $tscExit"

Write-Host ""
Write-Host "=== Step 2: esbuild ===" -ForegroundColor Cyan
node esbuild.mjs
$esbuildExit = $LASTEXITCODE
Write-Host "esbuild exit code: $esbuildExit"

Write-Host ""
Write-Host "=== Step 3: vitest ===" -ForegroundColor Cyan
npx vitest run
$vitestExit = $LASTEXITCODE
Write-Host "vitest exit code: $vitestExit"

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "tsc: $tscExit | esbuild: $esbuildExit | vitest: $vitestExit"
