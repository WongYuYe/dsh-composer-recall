# Current Architecture

## Frontend

- `frontend/server.js`: static hosting and upstream proxy
- `frontend/app.js`: browser UI
- `frontend/phaser-map.js`: map and scene rendering
- `frontend/build.mjs`: writes hashed assets to `frontend/dist/`

## Backend

- `backend/src/server.js`: local REST and websocket wrapper
- `backend/src/openclaw.js`: OpenClaw process runner

## Runtime Flow

1. Browser opens the local frontend server
2. Frontend reads the default upstream or a local backend
3. Browser refreshes through HTTP and websocket updates

## Current Decisions

- Default upstream is `https://www.wangyuye.online/pokemon-claw`
- `npm start` builds before serving
- HTML is not cached; built assets are hashed
- Runtime log files are not written
