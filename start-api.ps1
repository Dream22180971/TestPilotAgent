$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\testpilot-api"

# --- Optional LLM environment variables ---
# Set LLM_API_KEY to enable AI-powered analysis & generation (recommended):
#   $env:LLM_API_KEY = "sk-..."
#   $env:LLM_BASE_URL = "https://api.openai.com/v1"   # default
#   $env:LLM_MODEL = "gpt-4o"                           # default
#
# When LLM_API_KEY is empty (default), the system falls back to
# built-in rule-driven analysis with limited coverage.
# ---

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
