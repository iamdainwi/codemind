"""
github.py
GitHub OAuth integration and repository ingestion for CodeMind.

Provides:
  - make_state_token()     — create short-lived signed state for OAuth
  - decode_state_token()   — verify and decode state, return user_id
  - build_oauth_url()      — construct GitHub authorization URL
  - exchange_code()        — exchange OAuth code for access token
  - get_github_user()      — fetch GitHub user profile
  - list_repos()           — list all accessible repos (public + private)
  - ingest_github_repo()   — fetch repo tree and ingest all supported files
"""

import asyncio
import base64
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

import httpx
import jwt
from fastapi import HTTPException

from config import (
    logger,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_REDIRECT_URI,
    JWT_SECRET,
    JWT_ALGORITHM,
    SUPPORTED_EXTENSIONS,
)

_GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
_GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
_GITHUB_API = "https://api.github.com"

# Directories skipped during ingestion
_SKIP_DIRS = {
    "node_modules", "__pycache__", ".git", "dist", "build",
    ".next", "vendor", "target", "venv", ".venv", "coverage",
    ".mypy_cache", ".pytest_cache", "out", "tmp",
}

_MAX_FILE_BYTES = 500_000  # 500 KB


# ── OAuth state token ─────────────────────────────────────────────────────────

def make_state_token(flow: str, user_id: str = "") -> str:
    """
    Create a short-lived JWT to use as the OAuth state parameter.

    Args:
        flow:    "login"   — sign-in / sign-up via GitHub (no existing session)
                 "connect" — link GitHub to an already-authenticated account
        user_id: Required when flow="connect"; the CodeMind user's MongoDB ID.
    """
    payload: Dict = {
        "flow": flow,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    if user_id:
        payload["uid"] = user_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_state_token(state: str) -> Dict:
    """
    Verify and decode the OAuth state JWT.
    Returns {"flow": str, "uid": str} — uid may be empty for "login" flow.
    Raises 400 on invalid or expired state.
    """
    try:
        payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"flow": payload.get("flow", "connect"), "uid": payload.get("uid", "")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(400, "OAuth state expired — please try again")
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Invalid OAuth state parameter")


# ── OAuth URL ─────────────────────────────────────────────────────────────────

def build_oauth_url(state: str) -> str:
    """Construct the GitHub OAuth authorization URL."""
    params = urllib.parse.urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "repo read:user",
        "state": state,
    })
    return f"{_GITHUB_OAUTH_URL}?{params}"


# ── Token exchange ────────────────────────────────────────────────────────────

async def exchange_code(code: str) -> str:
    """Exchange a GitHub OAuth code for a persistent access token."""
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            _GITHUB_TOKEN_URL,
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

    data = res.json()
    if "error" in data:
        raise HTTPException(
            400,
            f"GitHub OAuth error: {data.get('error_description', data['error'])}",
        )
    token = data.get("access_token")
    if not token:
        raise HTTPException(500, "GitHub did not return an access token")
    return token


# ── GitHub API helpers ────────────────────────────────────────────────────────

def _gh_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }


async def get_github_user(token: str) -> Dict:
    """Fetch the authenticated GitHub user's public profile."""
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{_GITHUB_API}/user", headers=_gh_headers(token))
    res.raise_for_status()
    return res.json()


async def list_repos(token: str) -> List[Dict]:
    """
    List all repos accessible to the user (own + collaborator, public + private),
    sorted by last update. Returns summarised repo objects.
    """
    repos: List[Dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            res = await client.get(
                f"{_GITHUB_API}/user/repos",
                params={"type": "all", "per_page": 100, "page": page, "sort": "updated"},
                headers=_gh_headers(token),
            )
            res.raise_for_status()
            batch = res.json()
            if not batch:
                break
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1

    return [
        {
            "id": r["id"],
            "full_name": r["full_name"],
            "name": r["name"],
            "description": r.get("description") or "",
            "private": r["private"],
            "language": r.get("language") or "",
            "updated_at": r["updated_at"],
            "default_branch": r["default_branch"],
            "size": r["size"],  # KB
        }
        for r in repos
    ]


# ── Repository ingestion ──────────────────────────────────────────────────────

async def ingest_github_repo(
    token: str,
    full_name: str,
    branch: str,
    user_id: str,
) -> Dict:
    """
    Fetch the recursive git tree for `full_name@branch`, then download and
    ingest every supported file into Endee under `user_id`.

    Files are prefixed with `full_name/` to avoid path collisions between repos.
    Returns: {files_indexed, chunks_stored, files: [...], skipped: [...]}
    """
    # Lazy import to avoid circular dependency
    from ingestion import _ingest_single_file, _detect_language

    results: Dict = {
        "files_indexed": 0,
        "chunks_stored": 0,
        "files": [],
        "skipped": [],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        hdrs = _gh_headers(token)

        # 1. Fetch the full recursive file tree
        tree_res = await client.get(
            f"{_GITHUB_API}/repos/{full_name}/git/trees/{branch}",
            params={"recursive": "1"},
            headers=hdrs,
        )
        if tree_res.status_code == 404:
            raise HTTPException(404, f"Repo '{full_name}' or branch '{branch}' not found")
        tree_res.raise_for_status()
        tree_data = tree_res.json()

        if tree_data.get("truncated"):
            logger.warning(f"Git tree for {full_name} was truncated by GitHub (repo >100k files)")

        # 2. Filter to blobs we can ingest
        blobs_to_fetch: List[Dict] = []
        for item in tree_data.get("tree", []):
            if item["type"] != "blob":
                continue
            path: str = item["path"]
            parts = Path(path).parts
            # Skip hidden dirs (e.g. .github/) and known noise dirs
            if any(p.startswith(".") for p in parts[:-1]):
                continue
            if any(p in _SKIP_DIRS for p in parts):
                continue
            ext = Path(path).suffix.lower()
            if ext not in SUPPORTED_EXTENSIONS:
                results["skipped"].append(path)
                continue
            if item.get("size", 0) > _MAX_FILE_BYTES:
                results["skipped"].append(path)
                continue
            blobs_to_fetch.append({"path": path})

        logger.info(
            f"Fetching {len(blobs_to_fetch)} files from {full_name}@{branch} "
            f"({len(results['skipped'])} skipped)"
        )

        # 3. Fetch + ingest concurrently — max 10 simultaneous requests
        sem = asyncio.Semaphore(10)

        async def fetch_and_ingest(item: Dict) -> Dict:
            async with sem:
                file_path = item["path"]
                try:
                    res = await client.get(
                        f"{_GITHUB_API}/repos/{full_name}/contents/{file_path}",
                        params={"ref": branch},
                        headers=hdrs,
                    )
                    res.raise_for_status()
                    payload = res.json()
                    content_b64: str = payload.get("content", "")
                    content = base64.b64decode(content_b64).decode("utf-8", errors="replace")

                    indexed_path = f"{full_name}/{file_path}"
                    chunk_count, stored = _ingest_single_file(
                        indexed_path, content, user_id=user_id
                    )
                    return {
                        "ok": True,
                        "file_path": indexed_path,
                        "language": _detect_language(file_path),
                        "chunks": chunk_count,
                        "stored": stored,
                    }
                except Exception as exc:
                    logger.warning(f"Skipping '{file_path}': {exc}")
                    return {"ok": False, "file_path": file_path}

        outcomes = await asyncio.gather(*[fetch_and_ingest(b) for b in blobs_to_fetch])

    for outcome in outcomes:
        if outcome["ok"]:
            results["files_indexed"] += 1
            results["chunks_stored"] += outcome.get("stored", 0)
            results["files"].append({
                "file_path": outcome["file_path"],
                "language": outcome["language"],
                "chunks": outcome["chunks"],
            })
        else:
            results["skipped"].append(outcome["file_path"])

    logger.info(
        f"GitHub ingest complete — {full_name}: "
        f"{results['files_indexed']} files, {results['chunks_stored']} chunks, "
        f"{len(results['skipped'])} skipped"
    )
    return results
