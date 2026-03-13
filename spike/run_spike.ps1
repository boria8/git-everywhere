$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin\spike"
npm init -y 2>&1 | Out-Null
npm install execa@9 esbuild 2>&1 | Select-Object -Last 4
