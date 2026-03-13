$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin\spike"

Write-Host "--- Bundling with esbuild (CJS, platform node) ---"
node_modules\.bin\esbuild test.mjs --bundle --format=cjs --platform=node --outfile=dist_test.cjs 2>&1

Write-Host ""
Write-Host "--- Running bundled CJS output ---"
node dist_test.cjs 2>&1
