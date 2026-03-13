# CHANGE_SUMMARY_2026-03-12.md

## Title

refine open-pokemon-claw runtime shell and simplify upstream routing

## Summary

This round refines `open-pokemon-claw` from an experimental pixel dashboard into a lighter OpenClaw runtime shell with simpler routing, lower system impact, cleaner UI structure, and clearer documentation.

## 1. Runtime architecture

- Kept `open-pokemon-claw` as a standalone frontend aggregation service
- Stopped treating `npm run dev` / `node --watch` as a normal long-running mode
- Added production helper scripts:
  - `scripts/run-frontend-prod.sh`
  - `scripts/stop-frontend-prod.sh`

## 2. Lower impact on OpenClaw

- Slowed default polling cadence
- Disabled polling when there is no active demand
- Reduced startup / WS connect / task action forced refreshes
- Shifted the service toward a lower-impact runtime profile

## 3. Subpath and URL fixes

- Fixed subpath deployment behavior under `/open-pokemon-claw/`
- Fixed WebSocket path resolution for public deployment
- Removed bad task endpoint fallback behavior
- Stopped incorrect requests to:
  - `/api/openclaw/tasks/stats`
  - `/api/openclaw/tasks/runtime`

## 4. Upstream routing simplification

- Task endpoints are no longer derived incorrectly from `/api/openclaw/status`
- Frontend-facing request set is now narrowed to:
  - `GET /api/openclaw/status`
  - `WS /ws/openclaw/status`
  - `GET /api/tasks/stats`
  - `GET /api/tasks/runtime`
  - `GET /api/openclaw/diagnostics`
  - `POST /api/tasks/:taskId/retry`
  - `POST /api/tasks/:taskId/resolve`
- Aggregation layer upstream is now reduced to a single backend base:
  - `http://127.0.0.1:8787`

## 5. Static asset and page performance

- Added static caching behavior for HTML and assets
- Added `ETag` / `Last-Modified` support
- Reduced repeated reload cost for Phaser assets like `tuxemon.png`

## 6. Status parsing robustness

- Improved tolerance for noisy CLI output when reading OpenClaw status
- Prevented plugin-prefixed output from breaking JSON parsing logic

## 7. UI / product direction cleanup

- Reframed the page as a lightweight OpenClaw runtime shell
- Removed a large amount of debug, acceptance, and agent-internal UI clutter
- Simplified the right sidebar toward:
  - one main task card
  - one minimal summary strip
  - one main event stream
- Reduced engineering-heavy wording in the main UI

## 8. Code and documentation cleanup

- Removed frontend references that no longer matched the current DOM structure
- Updated README to reflect:
  - actual active endpoints
  - the single upstream backend address
  - paths that should no longer appear

## Current intended state

The current target state of `open-pokemon-claw` is:

- standalone process
- lighter operational profile
- correct subpath behavior
- correct task endpoint routing
- simplified upstream strategy
- cleaner runtime-shell UI
- documentation aligned with real behavior
