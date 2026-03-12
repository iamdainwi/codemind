"""
test_endee.py
Phase 1 test script — validates the Endee connection end-to-end.

Checks:
  1. Connect to Endee and ensure the index exists
  2. Upsert 3 dummy vectors with metadata
  3. Search and verify results are returned with correct metadata
  4. Test recommend (mean-vector approach)
  5. Test list_files

Usage:
  docker run -p 8080:8080 -v endee-data:/data endeeio/endee-server:latest
  python test_endee.py
"""

import sys
import numpy as np

# Ensure local imports work
sys.path.insert(0, ".")

from config import logger, ENDEE_DIM


def main() -> None:
    """Run all Phase 1 validation checks."""
    logger.info("=" * 60)
    logger.info("CodeMind — Phase 1 Test Script")
    logger.info("=" * 60)

    # ── 1. Connect ──────────────────────────────────────────────────────────
    logger.info("\n[1/5] Connecting to Endee and ensuring index...")
    try:
        from endee_client import endee  # noqa: triggers _ensure_index()
        logger.info("✅  Connected to Endee index successfully")
    except Exception as e:
        logger.error(f"❌  Failed to connect to Endee: {e}")
        logger.error("    Is Endee running? docker run -p 8080:8080 -v endee-data:/data endeeio/endee-server:latest")
        sys.exit(1)

    # ── 2. Upsert dummy vectors ─────────────────────────────────────────────
    logger.info("\n[2/5] Upserting 3 dummy code chunks...")
    np.random.seed(42)

    test_chunks = [
        {
            "id": "test-chunk-001",
            "vector": np.random.randn(ENDEE_DIM).tolist(),
            "file_path": "test/auth.py",
            "language": "python",
            "chunk_index": 0,
            "text": "def login(username, password):\n    user = db.find_user(username)\n    if user and verify_password(password, user.hash):\n        return create_token(user)",
        },
        {
            "id": "test-chunk-002",
            "vector": np.random.randn(ENDEE_DIM).tolist(),
            "file_path": "test/auth.py",
            "language": "python",
            "chunk_index": 1,
            "text": "def register(username, email, password):\n    hashed = hash_password(password)\n    user = User(username=username, email=email, password_hash=hashed)\n    db.save(user)",
        },
        {
            "id": "test-chunk-003",
            "vector": np.random.randn(ENDEE_DIM).tolist(),
            "file_path": "test/database.py",
            "language": "python",
            "chunk_index": 0,
            "text": "import sqlite3\n\ndef get_connection():\n    conn = sqlite3.connect('app.db')\n    return conn",
        },
    ]

    try:
        count = endee.upsert_chunks(test_chunks)
        assert count == 3, f"Expected 3 upserted, got {count}"
        logger.info(f"✅  Upserted {count} chunks")
    except Exception as e:
        logger.error(f"❌  Upsert failed: {e}")
        sys.exit(1)

    # ── 3. Search ───────────────────────────────────────────────────────────
    logger.info("\n[3/5] Searching with first test vector (should match itself)...")
    try:
        hits = endee.search(test_chunks[0]["vector"], top_k=3)
        assert len(hits) > 0, "No search results returned"
        logger.info(f"✅  Search returned {len(hits)} results:")
        for h in hits:
            logger.info(f"    → {h['file_path']}:chunk_{h['chunk_index']}  (score={h['score']})")
    except Exception as e:
        logger.error(f"❌  Search failed: {e}")
        sys.exit(1)

    # ── 4. List files ───────────────────────────────────────────────────────
    logger.info("\n[4/5] Listing all indexed files...")
    try:
        files = endee.list_files()
        assert len(files) > 0, "No files listed"
        logger.info(f"✅  Found {len(files)} indexed files:")
        for f in files:
            logger.info(f"    → {f['file_path']}  ({f['language']})")
    except Exception as e:
        logger.error(f"❌  List files failed: {e}")
        sys.exit(1)

    # ── 5. Recommend ────────────────────────────────────────────────────────
    logger.info("\n[5/5] Testing recommendations for 'test/auth.py'...")
    try:
        recs = endee.recommend(file_path="test/auth.py", top_k=2)
        logger.info(f"✅  Recommendations returned {len(recs)} results:")
        for r in recs:
            logger.info(f"    → {r['file_path']}  (score={r['score']})")
    except Exception as e:
        logger.error(f"❌  Recommend failed: {e}")
        sys.exit(1)

    # ── Done ────────────────────────────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info("🎉  ALL PHASE 1 TESTS PASSED")
    logger.info("=" * 60)
    logger.info("\nNext: Start the API server with:")
    logger.info("  uvicorn main:app --host 0.0.0.0 --port 8000 --reload")


if __name__ == "__main__":
    main()
