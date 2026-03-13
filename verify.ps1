$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npx tsc --noEmit
node esbuild.mjs
npx vitest run 2>&1 | Select-Object -Last 6
