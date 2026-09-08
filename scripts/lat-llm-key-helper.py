#!/usr/bin/env python3
"""Print a chat API key for Code-KG enrich (LAT_LLM_KEY_HELPER).

Prefers a live xAI OAuth access token from ~/.pi/agent/auth.json so enrich
can use Grok without storing a long-lived key in lat config.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    auth_path = Path.home() / ".pi" / "agent" / "auth.json"
    if not auth_path.is_file():
        print(f"missing {auth_path}", file=sys.stderr)
        return 1
    data = json.loads(auth_path.read_text(encoding="utf-8"))
    xai = data.get("xai") if isinstance(data, dict) else None
    if isinstance(xai, dict):
        token = xai.get("access")
        if isinstance(token, str) and token.strip():
            sys.stdout.write(token.strip())
            return 0
    print("no xai.access token in pi auth.json", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
