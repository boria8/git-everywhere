$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npx vitest run 2>&1
