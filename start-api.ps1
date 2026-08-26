$ErrorActionPreference = "Stop"
# TestPilot API (optional legacy FastAPI layer) — uses root project venv
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir testpilot-api
