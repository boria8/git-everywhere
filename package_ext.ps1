$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "C:\stuff\git\plugin"
npm install -g @vscode/vsce 2>&1 | Select-Object -Last 2
$npmGlobalBin = (npm root -g 2>$null | Split-Path -Parent) + "\bin"
if (Test-Path "$npmGlobalBin\vsce") {
    $env:PATH = "$npmGlobalBin;" + $env:PATH
}
# Try npx vsce as fallback
npx --yes @vscode/vsce package 2>&1
