$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npx tsc --version 2>&1
