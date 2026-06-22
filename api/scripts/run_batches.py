#!/usr/bin/env python3
"""Run Phase 1 maintenance batches: venue T3/90d, monthly badge goals.

Usage:
  cd weswim-backend
  .venv\\Scripts\\python scripts/run_batches.py

Schedule (production): hourly T3, daily 90d reject — see docs/OPERATION.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import get_db_connection
from app.services.badges import evaluate_monthly_attendance_goals
from app.services.venue_promotion import promote_t3_pending_48h, reject_pending_90_days


def main() -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            t3 = promote_t3_pending_48h(cur)
            rejected = reject_pending_90_days(cur)
            badges = evaluate_monthly_attendance_goals(cur)
            conn.commit()
    print(f"batch_ok t3_activated={t3} rejected_90d={rejected} monthly_goal_badges={badges}")


if __name__ == "__main__":
    main()
