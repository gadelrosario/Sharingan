from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database" / "fantasyhq.db"
SCHEMA = ROOT / "database" / "schema.sql"

conn = sqlite3.connect(DB)
conn.executescript(SCHEMA.read_text(encoding="utf-8"))
conn.close()
print(f"Initialized: {DB}")
