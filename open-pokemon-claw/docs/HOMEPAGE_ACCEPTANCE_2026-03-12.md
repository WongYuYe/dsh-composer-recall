# HOMEPAGE_ACCEPTANCE_2026-03-12.md

## Project

`open-pokemon-claw`

## Acceptance Date

2026-03-12

---

## 1. Scope

This acceptance round covers:

1. homepage main status endpoint
2. task stats endpoint
3. task runtime endpoint
4. diagnostics endpoint
5. WebSocket realtime status stream
6. subpath deployment behavior
7. page-side persistent WS connection
8. code operability after historical cleanup

---

## 2. Acceptance Results

### 2.1 Homepage main status endpoint
**Result:** Pass

- `GET /api/openclaw/status`
- Local and public access both return valid homepage state payloads.

### 2.2 Task stats endpoint
**Result:** Pass

- `GET /api/tasks/stats`
- Local and public access both return valid stats payloads.

### 2.3 Task runtime endpoint
**Result:** Pass

- `GET /api/tasks/runtime`
- Local and public access both return:
  - `currentTask`
  - `nextTask`
  - `queueSummary`

### 2.4 Diagnostics endpoint
**Result:** Pass

- `GET /api/openclaw/diagnostics`
- Exposes ws state, replay window, latest error, latest update time, and upstream candidates correctly.

### 2.5 WebSocket realtime stream
**Result:** Pass

- `WS /ws/openclaw/status`
- Public test successfully receives:
  - `hello`
  - `status snapshot`

### 2.6 Subpath deployment
**Result:** Pass

Under `/open-pokemon-claw/`, the following are working correctly:
- page path
- API paths
- WebSocket path
- tasks paths

### 2.7 Page-side persistent WS connection
**Result:** Pass

Diagnostics confirms `activeConnections > 0`, which means the browser page is maintaining a realtime connection rather than relying only on manual WS probes.

### 2.8 Wrong task path cleanup
**Result:** Pass

The incorrect historical request sources were removed:
- `/api/openclaw/tasks/stats`
- `/api/openclaw/tasks/runtime`

### 2.9 Upstream candidate simplification
**Result:** Pass

Aggregation layer upstream is now simplified to a single backend base:
- `http://127.0.0.1:8787`

The redundant parallel upstream candidate has been removed:
- `http://localhost:8787`

---

## 3. Cleanup Outcome

### Frontend structure cleanup
- removed debug-mode entry
- removed acceptance entry
- removed agent-internal interaction entry
- removed extra duplicated connection status block
- removed a batch of historical UI leftovers

### Frontend logic cleanup
- fixed DOM / JS mismatch
- removed wrong task endpoint derivation
- removed redundant fallback candidates
- removed part of outdated helper / formatting logic

### Styles cleanup
- removed a batch of historical style blocks
- kept styles needed by the current homepage core structure

---

## 4. Current Core Modules Kept

### UI core
- map area
- main status card
- minimal summary strip
- main event stream
- minimal task actions

### Data core
- `/api/openclaw/status`
- `/api/tasks/stats`
- `/api/tasks/runtime`
- `/api/openclaw/diagnostics`
- `WS /ws/openclaw/status`

### Runtime core
- `frontend/server.js`
- `frontend/app.js`
- `frontend/phaser-map.js`
- `scripts/run-frontend-prod.sh`
- `scripts/stop-frontend-prod.sh`

---

## 5. Product State

Current state can be regarded as:

> a lightweight OpenClaw runtime shell homepage that is deployable, subpath-safe, realtime-capable, and substantially cleaned up from its earlier experimental/debug-heavy form.

---

## 6. Optional Remaining Work

These are no longer blockers, only optional polish items:

1. further remove deeper one-off helper functions
2. continue trimming map-related historical CSS
3. further shorten event stream wording
4. improve responsive polish
5. create a formal active-endpoints document / doc index

---

## 7. Final Conclusion

**Homepage acceptance result: PASS**
