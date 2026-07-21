#!/usr/bin/env bash
#
# reset_db.sh — Drop all tables, re-run migrations, and re-seed.
#
# Usage:
#   chmod +x scripts/reset_db.sh
#   ./scripts/reset_db.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔄 Resetting database..."

cd "$BACKEND_DIR"

# Downgrade to nothing, then re-apply all migrations
echo "  1/3 Downgrading to base..."
python3 -m alembic downgrade base 2>/dev/null || true

echo "  2/3 Re-applying migrations..."
python3 -m alembic upgrade head

echo "  3/3 Seeding data..."
python3 scripts/seed.py

echo "✅ Database reset complete!"
