$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $taskRoot 'backend')
try {
    & "$taskRoot/.venv/Scripts/python.exe" -m app.init_db
    if ($LASTEXITCODE -ne 0) { throw 'Không khởi tạo được database.' }
    & "$taskRoot/.venv/Scripts/alembic.exe" upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Migration thất bại.' }
    & "$taskRoot/.venv/Scripts/python.exe" -m app.seed
    if ($LASTEXITCODE -ne 0) { throw 'Seed thất bại.' }
} finally { Pop-Location }
