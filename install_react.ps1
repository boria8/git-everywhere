$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npm install react react-dom @types/react @types/react-dom 2>&1 | Select-Object -Last 4
Write-Host "---"
node esbuild.mjs 2>&1
