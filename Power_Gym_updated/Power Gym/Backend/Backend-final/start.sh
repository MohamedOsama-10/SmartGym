#!/bin/sh
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
```

Commit `start.sh` — Railway will auto-redeploy. After it deploys, visit:
```
https://backend-production-c883.up.railway.app/health
