import os
import sys
import uvicorn
from .app import create_app
from .config import Config


def main():
    os.umask(0o077)
    config = Config.environment()
    from .restore import apply_pending
    apply_pending(config)
    uvicorn.run(
        create_app(config),
        host=config.host,
        port=config.port,
        proxy_headers=False,
        log_level="info",
        access_log=False,
        timeout_graceful_shutdown=5,
    )
    marker = config.data / "restart.json"
    if marker.exists():
        marker.unlink()
        os.execv(sys.executable, [sys.executable, "-m", "core"])


if __name__ == "__main__":
    main()
