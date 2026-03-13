$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npm install tinyexec@latest 2>&1
