@echo off
setlocal

set "OPENCLAW_STATUS_URL=https://www.wangyuye.online/pokemon-claw/api/openclaw/status"
set "OPENCLAW_TASK_STATS_URL=https://www.wangyuye.online/pokemon-claw/api/tasks/stats"
set "OPENCLAW_TASK_RUNTIME_URL=https://www.wangyuye.online/pokemon-claw/api/tasks/runtime"
set "OPENCLAW_TASK_ACTION_BASE_URL=https://www.wangyuye.online/pokemon-claw"
set "OPENCLAW_AGENT_TURN_URL=https://www.wangyuye.online/pokemon-claw/api/openclaw/agent/turn"

cd /d D:\Code\pokemon-claw\frontend
call "C:\Program Files\nodejs\npm.cmd" run start
