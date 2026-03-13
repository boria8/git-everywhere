$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npx tsc --noEmit 2>&1
Write-Host "TSC exit: $LASTEXITCODE"
