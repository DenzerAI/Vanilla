"""Explicit offline migration of this installation's legacy vault key."""
import argparse
import json
from pathlib import Path
from .config import Config
from .database import Database
from .provider_vault import ProviderVault


def main():
    parser = argparse.ArgumentParser(description='Vorhandenen Vanilla-Tresor in die geschützte Schlüsselverwaltung übernehmen; Kern vorher stoppen.')
    parser.add_argument('--data', type=Path)
    args = parser.parse_args()
    config = Config.environment(load_credentials=False)
    if args.data is not None:
        from .isolation import inside
        config.data = inside(config.root, args.data)
    db = Database(config.data / 'agent.sqlite3')
    try:
        result = ProviderVault(config.data / 'provider-vault', db).migrate()
        print(json.dumps(result))
    finally:
        db.close()


if __name__ == '__main__':
    main()
