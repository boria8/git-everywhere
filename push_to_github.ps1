$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
git init
git add .
git commit -m "Initial release v0.1.0 - GitEverywhere VSCode extension"
git branch -M main
git remote add origin https://github.com/boria8/git-everywhere.git
git push -u origin main 2>&1
