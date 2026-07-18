import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database" / "fantasyhq.db"

conn = sqlite3.connect(DB)
assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
assert conn.execute("SELECT COUNT(*) FROM players").fetchone()[0] > 100
assert conn.execute("SELECT COUNT(*) FROM expert_rankings").fetchone()[0] > 100
print("All backend smoke tests passed.")
