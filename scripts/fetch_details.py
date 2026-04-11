"""One-off bulk fetcher for MPSA 2026 session detail pages.

Reads all listing HTML files in raw_html/, extracts session IDs,
then fetches each session's detail page via the public direct_link
endpoint. Saves to raw_html/details/session_<id>.html.

Usage:
    python3 scripts/fetch_details.py
"""
from __future__ import annotations

import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RAW_HTML = ROOT / "raw_html"
DETAIL_DIR = RAW_HTML / "details"

DETAIL_URL = (
    "http://convention2.allacademic.com/one/mpsa/mpsa26/index.php"
    "?program_focus=view_session&selected_session_id={id}"
    "&cmd=online_program_direct_link&sub_action=online_program"
)

USER_AGENT = "Mozilla/5.0 (mpsa-viewer local data collection)"
TIMEOUT = 30
MAX_WORKERS = 10
MIN_BYTES = 5000  # below this, assume fetch failed or page is empty


def list_listing_files() -> list[Path]:
    files = sorted(RAW_HTML.glob("day*-*.html"))
    if not files:
        print("ERROR: no day*.html files found in raw_html/", file=sys.stderr)
        sys.exit(1)
    return files


def collect_session_ids(listing_files: list[Path]) -> list[str]:
    """Each listing file contains both `session_NNNNNN` (real session containers)
    and `session_result_NNNNNN` (search-result wrappers for the same session).
    We only want the purely numeric ones."""
    import re
    numeric = re.compile(r"^session_(\d+)$")
    ids: list[str] = []
    seen: set[str] = set()
    for f in listing_files:
        soup = BeautifulSoup(f.read_text(encoding="utf-8"), "lxml")
        nodes = soup.select('div[id^="session_"]')
        file_ids: list[str] = []
        for n in nodes:
            m = numeric.match(n.get("id", ""))
            if m:
                file_ids.append(m.group(1))
        for sid in file_ids:
            if sid not in seen:
                seen.add(sid)
                ids.append(sid)
        print(f"  {f.name}: {len(file_ids)} sessions ({len(seen)} unique so far)")
    return ids


def fetch_one(session_id: str) -> tuple[str, int, str | None]:
    """Fetch one session detail page. Returns (id, size_bytes, error_or_none)."""
    url = DETAIL_URL.format(id=session_id)
    out = DETAIL_DIR / f"session_{session_id}.html"
    if out.exists() and out.stat().st_size >= MIN_BYTES:
        return (session_id, out.stat().st_size, "cached")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = r.read()
        if len(data) < MIN_BYTES:
            return (session_id, len(data), f"too small ({len(data)}b)")
        out.write_bytes(data)
        return (session_id, len(data), None)
    except Exception as e:
        return (session_id, 0, f"{type(e).__name__}: {e}")


def main() -> int:
    DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    listing = list_listing_files()
    print(f"Listing files: {len(listing)}")
    ids = collect_session_ids(listing)
    print(f"Total unique session IDs: {len(ids)}")

    print(f"Fetching with {MAX_WORKERS} workers...")
    t0 = time.time()
    done = 0
    cached = 0
    errors: list[tuple[str, str]] = []
    total_bytes = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_one, sid): sid for sid in ids}
        for fut in as_completed(futures):
            sid, size, err = fut.result()
            done += 1
            if err == "cached":
                cached += 1
                total_bytes += size
            elif err is None:
                total_bytes += size
            else:
                errors.append((sid, err))
            if done % 50 == 0 or done == len(ids):
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                print(f"  {done}/{len(ids)} ({done*100//len(ids)}%) — {rate:.1f}/s — {total_bytes/1024/1024:.1f} MB")

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Fetched: {len(ids) - len(errors) - cached}")
    print(f"  Cached (already on disk): {cached}")
    print(f"  Errors: {len(errors)}")
    print(f"  Total size: {total_bytes/1024/1024:.1f} MB")
    if errors:
        print("\nErrors:")
        for sid, err in errors[:20]:
            print(f"  {sid}: {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
