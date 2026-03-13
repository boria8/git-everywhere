$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
node esbuild.mjs
npx @vscode/vsce package 2>&1
