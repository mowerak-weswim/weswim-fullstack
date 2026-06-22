# WeSwim API — always uses weswim-backend/.venv (avoids global Python 3.14 / Anaconda without deps)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Host "Creating .venv ..."
    py -3.11 -m venv (Join-Path $Root ".venv") 2>$null
    if (-not (Test-Path $Python)) {
        python -m venv (Join-Path $Root ".venv")
    }
    & $Python -m pip install -r (Join-Path $Root "requirements.txt")
}

Set-Location $Root
& $Python -m uvicorn main:app --reload --port 8000 @args
