$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $taskRoot 'backend')
$taskApiPort = & "$taskRoot/.venv/Scripts/python.exe" -c "from app.core.config import get_settings; print(get_settings().api_port)"
if ($LASTEXITCODE -ne 0) { throw 'Không đọc được cấu hình backend.' }
& "$taskRoot/.venv/Scripts/python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port $taskApiPort --no-access-log
