import os
import sys
import uvicorn
from .app import create_app
from .config import Config


def main():
    os.umask(0o077)
    config = Config.environment(load_credentials=False)
    from .restore import apply_pending
    apply_pending(config)
    config = Config.environment()
    app = create_app(config)
    server = uvicorn.Server(uvicorn.Config(
        app,
        host=config.host,
        port=config.port,
        proxy_headers=False,
        log_level="info",
        access_log=False,
        timeout_graceful_shutdown=5,
    ))
    # Controlled restart must return to execv. Re-raising SIGTERM after
    # graceful shutdown (uvicorn) would terminate a manually started core.
    app.state.runtime.shutdown = lambda: setattr(server, "should_exit", True)
    server.run()
    if not server.started:
        raise SystemExit(3)
    marker = config.data / "restart.json"
    if marker.exists():
        marker.unlink()
        os.execv(sys.executable, [sys.executable, "-m", "core"])


if __name__ == "__main__":
    main()
