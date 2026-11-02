#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/../backend"
python -m app.init_db
alembic upgrade head
python -m app.seed
