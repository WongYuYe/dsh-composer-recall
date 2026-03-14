const {
  countArray,
  firstFiniteNumber,
  isPlainObject,
  toFiniteNumber,
} = require("./utils");

function createDashboardHelpers(config) {
  function normalizeTaskRecord(task) {
    if (!isPlainObject(task)) {
      return null;
    }

    return {
      taskId: task.taskId || task.id || "",
      agentId: task.agentId || task.agent || task.ownerId || task.assignee?.agentId || "",
      assignee: task.assignee?.name || task.assignee || task.owner || "",
      sessionKey: task.sessionKey || task.session?.key || "",
      title: task.title || task.name || "",
      status: String(task.status || "").toLowerCase(),
      priority: task.priority || "",
      progress: toFiniteNumber(task.progress),
      dueAt: task.dueAt || "",
      updatedAt: task.updatedAt || "",
      startedAt: task.startedAt || task.updatedAt || "",
      etaSeconds: firstFiniteNumber(task.etaSeconds, task.eta),
      failureReason: task.failureReason || "",
      lastError: task.lastError || "",
      availableActions: Array.isArray(task.availableActions)
        ? task.availableActions.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
        : [],
    };
  }

  function deriveTaskStatsFromPayload(payload) {
    const root = payload?.data || payload?.stats || payload;
    if (!root || typeof root !== "object") {
      return null;
    }

    const taskCounts = isPlainObject(root.taskCount) ? root.taskCount : null;
    const taskList = Array.isArray(root.taskList)
      ? root.taskList
      : Array.isArray(root.items)
        ? root.items
        : Array.isArray(root.tasks)
          ? root.tasks
          : Array.isArray(root.list)
            ? root.list
            : [];
    const groupedTaskCount =
      ["todo", "doing", "blocked", "inProgress", "pending"].some((key) => toFiniteNumber(taskCounts?.[key]) !== null || toFiniteNumber(root[key]) !== null)
        ? ["todo", "doing", "blocked", "inProgress", "pending"].reduce((sum, key) => {
            return sum + (toFiniteNumber(taskCounts?.[key]) || toFiniteNumber(root[key]) || 0);
          }, 0)
        : null;

    const itemsCount = taskList.length || null;
    const taskCount = firstFiniteNumber(
      taskCounts?.total,
      root.taskCount,
      root.activeTaskCount,
      root.openTaskCount,
      root.currentTaskCount,
      root.count,
      groupedTaskCount,
      itemsCount,
    );
    const totalTasks = firstFiniteNumber(
      taskCounts?.total,
      root.totalTasks,
      root.total,
      root.taskTotal,
      root.allTaskCount,
      itemsCount,
      taskCount,
    );

    if (taskCount === null && totalTasks === null) {
      return null;
    }

    const normalizedTaskList = taskList
      .map((task) => normalizeTaskRecord(task))
      .filter(Boolean);
    const currentTask = normalizedTaskList.find((task) => task.status === "doing")
      || normalizedTaskList.find((task) => task.status === "blocked")
      || normalizedTaskList[0]
      || null;

    return {
      taskCount: taskCount ?? totalTasks ?? 0,
      totalTasks: totalTasks ?? taskCount ?? 0,
      todo: firstFiniteNumber(taskCounts?.todo, root.todo),
      doing: firstFiniteNumber(taskCounts?.doing, root.doing, root.inProgress),
      blocked: firstFiniteNumber(taskCounts?.blocked, root.blocked),
      done: firstFiniteNumber(taskCounts?.done, root.done),
      projectId: root.projectId || "",
      projectName: root.projectName || "",
      taskList: normalizedTaskList,
      currentTask,
      source: config.taskStatsUrl ? "task-stats-endpoint" : "task-stats-auto",
    };
  }

  function deriveTaskStatsFromStatus(status) {
    const hasTaskSignals =
      status?.taskCount !== undefined ||
      status?.activeTaskCount !== undefined ||
      status?.totalTasks !== undefined ||
      status?.taskTotal !== undefined ||
      status?.taskList !== undefined ||
      status?.activeTasks !== undefined ||
      status?.queuedTasks !== undefined ||
      (status?.tasks && typeof status.tasks === "object");

    if (!hasTaskSignals) {
      return null;
    }

    const groupedTaskCount =
      ["todo", "doing", "blocked", "inProgress", "pending"].some((key) => toFiniteNumber(status?.tasks?.[key]) !== null || toFiniteNumber(status?.[key]) !== null)
        ? ["todo", "doing", "blocked", "inProgress", "pending"].reduce((sum, key) => {
            return sum + (toFiniteNumber(status?.tasks?.[key]) || toFiniteNumber(status?.[key]) || 0);
          }, 0)
        : null;

    const listCount =
      countArray(status?.tasks?.items) ??
      countArray(status?.tasks) ??
      countArray(status?.taskList) ??
      countArray(status?.activeTasks) ??
      countArray(status?.queuedTasks);

    const taskCount = firstFiniteNumber(
      status?.taskCount,
      status?.activeTaskCount,
      status?.tasks?.count,
      status?.tasks?.active,
      status?.tasks?.activeCount,
      groupedTaskCount,
      listCount,
    );
    const totalTasks = firstFiniteNumber(
      status?.totalTasks,
      status?.tasks?.total,
      status?.taskTotal,
      listCount,
      taskCount,
    );

    if (taskCount === null && totalTasks === null) {
      return null;
    }

    return {
      taskCount: taskCount ?? totalTasks ?? 0,
      totalTasks: totalTasks ?? taskCount ?? 0,
      source: "status",
    };
  }

  function deriveTaskRuntimeFromPayload(payload) {
    const root = payload?.data || payload?.runtime || payload;
    if (!root || typeof root !== "object") {
      return null;
    }

    const currentTaskRoot = isPlainObject(root.currentTask) ? root.currentTask : null;
    const nextTaskRoot = isPlainObject(root.nextTask) ? root.nextTask : null;
    const queueSummaryRoot = isPlainObject(root.queueSummary) ? root.queueSummary : null;

    const queued = firstFiniteNumber(queueSummaryRoot?.queued, root.queued, root.queueCount);
    const running = firstFiniteNumber(
      queueSummaryRoot?.running,
      root.running,
      root.runningCount,
      currentTaskRoot ? 1 : null,
    );
    const failed = firstFiniteNumber(queueSummaryRoot?.failed, root.failed, root.failedCount);

    if (!currentTaskRoot && !nextTaskRoot && queued === null && running === null && failed === null) {
      return null;
    }

    return {
      currentTask: normalizeTaskRecord(currentTaskRoot),
      nextTask: nextTaskRoot
        ? {
            ...normalizeTaskRecord(nextTaskRoot),
            scheduledAt: nextTaskRoot.scheduledAt || nextTaskRoot.dueAt || "",
          }
        : null,
      queueSummary: {
        queued: queued ?? 0,
        running: running ?? 0,
        failed: failed ?? 0,
      },
      source: config.taskRuntimeUrl ? "task-runtime-endpoint" : "task-runtime-auto",
    };
  }

  function synthesizeTaskRuntimeFromTaskStats(taskStats) {
    if (!taskStats) {
      return null;
    }

    const queued = firstFiniteNumber(taskStats.todo, taskStats.pending, 0);
    const running = firstFiniteNumber(taskStats.doing, taskStats.inProgress, 0);
    const failed = firstFiniteNumber(taskStats.blocked, 0);

    if (!taskStats.currentTask && queued === null && running === null && failed === null) {
      return null;
    }

    return {
      currentTask: taskStats.currentTask
        ? {
          taskId: taskStats.currentTask.taskId || "",
          agentId: taskStats.currentTask.agentId || "",
          assignee: taskStats.currentTask.assignee || "",
          sessionKey: taskStats.currentTask.sessionKey || "",
          title: taskStats.currentTask.title || "",
          status: taskStats.currentTask.status || (running > 0 ? "running" : "queued"),
          startedAt: taskStats.currentTask.updatedAt || "",
            progress: taskStats.currentTask.progress ?? null,
            etaSeconds: null,
            availableActions: taskStats.currentTask.availableActions || [],
          }
        : null,
      nextTask: null,
      queueSummary: {
        queued: queued ?? 0,
        running: running ?? 0,
        failed: failed ?? 0,
      },
      source: "task-stats-fallback",
    };
  }

  function mapAlertLevel(status) {
    const explicit = String(status?.alertLevel || status?.alert || status?.riskLevel || "")
      .trim()
      .toUpperCase();
    if (["GREEN", "BLUE", "AMBER", "RED", "OFFLINE"].includes(explicit)) {
      return explicit;
    }

    const reachable = Boolean(status?.gateway?.reachable);
    const critical = Number(status?.securityAudit?.summary?.critical || 0);
    const warn = Number(status?.securityAudit?.summary?.warn || 0);

    if (!reachable || critical > 0) {
      return "RED";
    }
    if (warn > 0) {
      return "AMBER";
    }
    return "GREEN";
  }

  function mapExplicitZone(status) {
    const raw = String(status?.zone || status?.currentZone || status?.area || "").trim().toLowerCase();
    if (!raw) {
      return "";
    }

    if (["rest", "idle", "standby", "sleep", "room", "home", "休息", "待机", "房间"].some((token) => raw.includes(token))) {
      return "rest";
    }
    if (["work", "running", "task", "job", "工作", "执行", "工位"].some((token) => raw.includes(token))) {
      return "work";
    }
    if (["alarm", "alert", "warning", "danger", "警报", "告警", "异常"].some((token) => raw.includes(token))) {
      return "work";
    }

    return "";
  }

  function mapZone(status, alertLevel, taskStats, taskRuntime) {
    const explicitZone = mapExplicitZone(status);
    if (explicitZone) {
      return explicitZone;
    }

    const taskCount = toFiniteNumber(taskStats?.taskCount);
    const doingCount = toFiniteNumber(taskStats?.doing);
    const blockedCount = toFiniteNumber(taskStats?.blocked);
    const runningCount = toFiniteNumber(taskRuntime?.queueSummary?.running);
    const failedCount = toFiniteNumber(taskRuntime?.queueSummary?.failed);
    const recentMain = status?.sessions?.recent?.find?.((item) => String(item?.key || "").startsWith("agent:main:")) || null;
    const mainRecentlyActive = recentMain && Number(recentMain.age) >= 0 && Number(recentMain.age) < 10 * 60 * 1000;
    const text = `${status?.task || ""} ${status?.description || ""} ${taskRuntime?.currentTask?.title || ""}`.toLowerCase();
    const alarmLike = ["alarm", "alert", "warning", "danger", "警报", "告警", "异常", "风险"].some((token) => text.includes(token));

    if (doingCount !== null || blockedCount !== null || taskCount !== null || runningCount !== null || failedCount !== null) {
      if ((failedCount || blockedCount || 0) > 0) {
        return "work";
      }
      if ((runningCount || doingCount || 0) > 0) {
        return "work";
      }
      if (mainRecentlyActive) {
        return "work";
      }
      return "rest";
    }

    if (mainRecentlyActive) {
      return "work";
    }

    return alarmLike ? "work" : "rest";
  }

  function zonePosition(zone) {
    if (zone === "work") {
      return { x: 17, y: 7 };
    }
    return { x: 4, y: 6 };
  }

  function translateTaskStatus(status) {
    const raw = String(status || "").trim().toLowerCase();
    const labels = {
      todo: "待开始",
      doing: "进行中",
      running: "运行中",
      queued: "排队中",
      blocked: "已阻塞",
      failed: "执行失败",
      done: "已完成",
      archived: "已归档",
    };

    return labels[raw] || raw || "待开始";
  }

  function formatEtaLabel(seconds) {
    const numeric = toFiniteNumber(seconds);
    if (numeric === null || numeric < 0) {
      return "";
    }

    if (numeric < 60) {
      return `${Math.round(numeric)} 秒`;
    }

    const minutes = Math.floor(numeric / 60);
    const remainSeconds = Math.round(numeric % 60);
    return remainSeconds > 0 ? `${minutes} 分 ${remainSeconds} 秒` : `${minutes} 分钟`;
  }

  function buildRuntimeSummary(taskRuntime) {
    if (!taskRuntime) {
      return null;
    }

    const parts = [];
    const currentTask = taskRuntime.currentTask;
    const nextTask = taskRuntime.nextTask;
    const queueSummary = taskRuntime.queueSummary || {};

    if (currentTask?.title) {
      const currentBits = [`当前执行 ${currentTask.title}`];
      if (currentTask.progress !== null && currentTask.progress !== undefined) {
        currentBits.push(`${Math.round(currentTask.progress)}%`);
      }
      const etaLabel = formatEtaLabel(currentTask.etaSeconds);
      if (etaLabel) {
        currentBits.push(`预计 ${etaLabel}`);
      }
      parts.push(currentBits.join(" · "));
    }

    if (nextTask?.title) {
      parts.push(`下一项 ${nextTask.title}`);
    }

    if (queueSummary.queued !== undefined || queueSummary.running !== undefined || queueSummary.failed !== undefined) {
      parts.push(`队列：排队 ${queueSummary.queued ?? 0} · 运行中 ${queueSummary.running ?? 0} · 失败 ${queueSummary.failed ?? 0}`);
    }

    return parts.join(" ｜ ");
  }

  function buildTaskSummary(taskStats) {
    if (!taskStats) {
      return null;
    }

    const total = toFiniteNumber(taskStats.totalTasks ?? taskStats.taskCount);
    const doing = toFiniteNumber(taskStats.doing);
    const blocked = toFiniteNumber(taskStats.blocked);
    const projectName = taskStats.projectName || "OpenClaw任务中心";
    const blockedText = (blocked || 0) > 0 ? ` · 阻塞 ${blocked}` : "";

    return (total ?? 0) <= 0
      ? `${projectName} · 当前无任务`
      : `${projectName} · 共 ${total ?? 0} 项 · 进行中 ${doing ?? 0}${blockedText}`;
  }

  function inferDerivedAgentStatus(agentId, recent, zone, alertLevel) {
    if (alertLevel === "RED" && agentId === "ops") {
      return "blocked";
    }

    const age = toFiniteNumber(recent?.age);
    if (age === null || age >= 5 * 60 * 1000) {
      return "offline";
    }

    if (zone === "rest") {
      return "resting";
    }

    if (zone === "work") {
      return agentId === "main" ? "running" : "standby";
    }

    return "standby";
  }

  function deriveSystemMode(explicitMode, reachable, taskStats, taskRuntime, agentStates, gatewayOk) {
    const normalized = String(explicitMode || "RUNNING").trim().toUpperCase() || "RUNNING";
    const failedCount = (toFiniteNumber(taskRuntime?.queueSummary?.failed) || 0) + (toFiniteNumber(taskStats?.blocked) || 0);
    const runningCount = (toFiniteNumber(taskRuntime?.queueSummary?.running) || 0) + (toFiniteNumber(taskStats?.doing) || 0);
    const queuedCount = (toFiniteNumber(taskRuntime?.queueSummary?.queued) || 0) + (toFiniteNumber(taskStats?.todo) || 0);
    const enabledAgents = Array.isArray(agentStates) ? agentStates.filter((agent) => agent?.enabled !== false) : [];

    if (failedCount > 0) {
      return "ERROR";
    }

    if (runningCount > 0) {
      return ["RUNNING", "ACTIVE"].includes(normalized) ? normalized : "RUNNING";
    }

    if (!reachable || gatewayOk === false || (enabledAgents.length > 0 && enabledAgents.every((agent) => !agent.active))) {
      return "OFFLINE";
    }

    if (queuedCount > 0) {
      return "QUEUED";
    }

    if (enabledAgents.length > 0 && enabledAgents.every((agent) => agent.status === "resting")) {
      return "RESTING";
    }

    if (enabledAgents.some((agent) => agent.status === "standby")) {
      return "STANDBY";
    }

    return normalized === "SLEEP" ? "RESTING" : "STANDBY";
  }

  function deriveAgentStatesFromStatus(status, zone, alertLevel) {
    if (Array.isArray(status?.openclaw?.agents) && status.openclaw.agents.length > 0) {
      return status.openclaw.agents.map((agent) => ({
        ...agent,
        source: agent?.source || "status-payload",
        active: agent?.active === true || Boolean(agent?.session),
      }));
    }

    const configuredAgents = Array.isArray(status?.heartbeat?.agents) ? status.heartbeat.agents : [];
    const recentSessions = Array.isArray(status?.sessions?.recent) ? status.sessions.recent : [];
    const recentByAgent = new Map();

    for (const session of recentSessions) {
      const agentId = String(session?.agentId || "").trim();
      if (!agentId || recentByAgent.has(agentId)) {
        continue;
      }
      recentByAgent.set(agentId, session);
    }

    const defaultZones = {
      main: "work",
      research: zone === "work" ? "work" : "rest",
      executor: zone === "work" ? "work" : "rest",
      ops: "rest",
    };

    return configuredAgents.map((agent, index) => {
      const agentId = String(agent?.agentId || "").trim();
      const recent = recentByAgent.get(agentId) || null;
      const statusValue = inferDerivedAgentStatus(agentId, recent, zone, alertLevel);

      return {
        id: agentId,
        name: agentId,
        enabled: Boolean(agent?.enabled),
        source: "heartbeat",
        active: Boolean(recent),
        heartbeatEvery: agent?.every || "",
        heartbeatEveryMs: agent?.everyMs ?? null,
        zone: defaultZones[agentId] || (index % 2 === 0 ? "work" : "rest"),
        status: statusValue,
        session: recent
          ? {
              key: recent.key || "",
              updatedAt: recent.updatedAt || null,
              age: recent.age ?? null,
              percentUsed: recent.percentUsed ?? null,
              model: recent.model || "",
            }
          : null,
      };
    });
  }

  function readExplicitPosition(status) {
    const x = firstFiniteNumber(status?.position?.x, status?.coords?.x, status?.coordinate?.x, status?.tile?.x, status?.x);
    const y = firstFiniteNumber(status?.position?.y, status?.coords?.y, status?.coordinate?.y, status?.tile?.y, status?.y);
    return x === null || y === null ? null : { x, y };
  }

  function hasExplicitStatusFields(status) {
    return Boolean(
      mapExplicitZone(status)
      || status?.task
      || status?.taskName
      || status?.description
      || status?.message
      || status?.mode
      || status?.alertLevel
      || readExplicitPosition(status),
    );
  }

  function toDashboardPayload(status, taskStats, taskRuntime, sourceState = {}) {
    const alertLevel = mapAlertLevel(status);
    const resolvedTaskStats = taskStats || deriveTaskStatsFromStatus(status) || {
      taskCount: 0,
      totalTasks: 0,
      source: "empty-fallback",
    };
    const resolvedTaskRuntime = taskRuntime || synthesizeTaskRuntimeFromTaskStats(resolvedTaskStats);
    const zone = mapZone(status, alertLevel, resolvedTaskStats, resolvedTaskRuntime);
    const explicitTask = String(status?.task || status?.taskName || status?.action || "").trim();
    const explicitDescription = String(status?.description || status?.message || status?.statusText || "").trim();
    const explicitMode = String(status?.mode || status?.status || "").trim().toUpperCase();
    const explicitPosition = readExplicitPosition(status);
    const recent = status?.sessions?.recent?.[0] || null;
    const now = new Date().toISOString();
    const position = explicitPosition || zonePosition(zone);
    const reachable = status?.gateway?.reachable !== undefined ? Boolean(status?.gateway?.reachable) : hasExplicitStatusFields(status);
    const queued = Array.isArray(status?.queuedSystemEvents) ? status.queuedSystemEvents.length : 0;
    const currentTask = resolvedTaskRuntime?.currentTask || resolvedTaskStats?.currentTask || null;
    const nextTask = resolvedTaskRuntime?.nextTask || null;
    const runtimeSummary = buildRuntimeSummary(resolvedTaskRuntime);
    const taskSummary = buildTaskSummary(resolvedTaskStats);
    const agentStates = deriveAgentStatesFromStatus(status, zone, alertLevel);
    const activeAgentCount = agentStates.filter((agent) => agent.active).length;
    const agentSources = [...new Set(agentStates.map((agent) => String(agent?.source || "").trim()).filter(Boolean))];
    const summaryRoot = status?.openclaw?.summary && typeof status.openclaw.summary === "object"
      ? status.openclaw.summary
      : {};
    const agentSource = status?.openclaw?.summary?.agentSource
      || (agentSources.length === 1 ? agentSources[0] : agentSources[0] || "status-payload");
    const gatewayOk = typeof summaryRoot.gatewayOk === "boolean"
      ? summaryRoot.gatewayOk
      : sourceState.statusFetchOk && status?.gateway?.reachable !== undefined
        ? Boolean(status.gateway.reachable)
        : null;
    const rawStatusAvailable = typeof summaryRoot.rawStatusAvailable === "boolean"
      ? summaryRoot.rawStatusAvailable
      : sourceState.statusFetchOk ?? null;
    const rawHealthAvailable = typeof summaryRoot.rawHealthAvailable === "boolean"
      ? summaryRoot.rawHealthAvailable
      : null;
    const rawCronAvailable = typeof summaryRoot.rawCronAvailable === "boolean"
      ? summaryRoot.rawCronAvailable
      : null;
    const doingCount = toFiniteNumber(resolvedTaskStats?.doing);
    const blockedCount = toFiniteNumber(resolvedTaskStats?.blocked);
    const runningCount = toFiniteNumber(resolvedTaskRuntime?.queueSummary?.running);
    const queuedCount = toFiniteNumber(resolvedTaskRuntime?.queueSummary?.queued);
    const failedCount = toFiniteNumber(resolvedTaskRuntime?.queueSummary?.failed);
    const mode = deriveSystemMode(
      explicitMode,
      reachable,
      resolvedTaskStats,
      resolvedTaskRuntime,
      agentStates,
      gatewayOk,
    );
    const contextTokens = Number(recent?.contextTokens || 0);
    const inputTokens = Number(recent?.inputTokens || 0);
    const outputTokens = Number(recent?.outputTokens || 0);
    const computedLoad = contextTokens > 0 ? ((inputTokens + outputTokens) / contextTokens) * 100 : NaN;

    let task = "Gateway unreachable";
    if (reachable) {
      if (explicitTask) {
        task = explicitTask;
      } else if (currentTask?.title) {
        task = currentTask.title;
      } else if (zone === "rest") {
        task = (queuedCount || 0) > 0 ? (nextTask?.title || "等待任务安排") : "休息中";
      } else if ((failedCount || blockedCount || 0) > 0) {
        task = "警报处理中";
      } else if ((runningCount || doingCount || 0) > 0) {
        task = `进行中任务 ${runningCount || doingCount || 0} 项`;
      } else {
        task = "待命中";
      }
    }

    const description = reachable
      ? explicitDescription
        ? explicitDescription
        : currentTask?.title
          ? runtimeSummary || taskSummary || `Gateway online · sessions=${status?.sessions?.count || 0}`
          : zone === "rest"
            ? `${config.robotName}当前没有运行任务，正在休息区待命。`
            : runtimeSummary || taskSummary || `Gateway online · sessions=${status?.sessions?.count || 0}`
      : "Gateway offline. Check token / service / CORS settings.";

    const logs = [
      { zone: "system", time: now, message: reachable ? "状态同步完成" : "状态同步失败" },
    ];

    if (recent?.key) {
      logs.unshift({ zone, time: now, message: `最近活跃：${recent.key}` });
    }

    if (currentTask?.title) {
      logs.unshift({
        zone,
        time: currentTask.updatedAt || currentTask.startedAt || now,
        message: `${currentTask.title} · ${translateTaskStatus(currentTask.status)} · ${(currentTask.progress ?? 0)}%${currentTask.etaSeconds ? ` · 预计 ${formatEtaLabel(currentTask.etaSeconds)}` : ""}`,
      });
    }

    if (nextTask?.title) {
      logs.unshift({
        zone,
        time: nextTask.scheduledAt || now,
        message: `下一任务：${nextTask.title} · ${translateTaskStatus(nextTask.status)}${nextTask.scheduledAt ? ` · 计划 ${nextTask.scheduledAt}` : ""}`,
      });
    }

    if (resolvedTaskRuntime?.queueSummary) {
      logs.unshift({
        zone: "system",
        time: now,
        message: `任务队列：排队 ${queuedCount ?? 0} · 运行中 ${runningCount ?? 0} · 失败 ${failedCount ?? 0}`,
      });
    }

    return {
      zone,
      scene: "room",
      idleActivity: "",
      position,
      task,
      description,
      mode,
      alertLevel,
      load: Number.isFinite(computedLoad) ? Math.max(0, Math.min(100, Math.round(computedLoad))) : null,
      battery: reachable ? 100 : 15,
      temperature: alertLevel === "RED" ? 70 : alertLevel === "AMBER" ? 58 : 45,
      taskCount: resolvedTaskStats.taskCount,
      queue: queued,
      updatedAt: now,
      logs,
      openclaw: {
        agents: agentStates,
        tasks: resolvedTaskStats,
        runtime: resolvedTaskRuntime,
        gateway: status?.gateway || null,
        summary: {
          ...summaryRoot,
          gatewayOk,
          agentSource,
          configuredAgentCount: summaryRoot.configuredAgentCount ?? agentStates.length,
          activeAgentCount: summaryRoot.activeAgentCount ?? activeAgentCount,
          rawStatusAvailable,
          rawHealthAvailable,
          rawCronAvailable,
          taskSource: resolvedTaskStats?.source || "",
          runtimeSource: resolvedTaskRuntime?.source || "",
        },
        sessions: {
          count: status?.sessions?.count || 0,
          latest: recent
            ? {
                key: recent.key,
                updatedAt: recent.updatedAt,
                inputTokens: recent.inputTokens,
                outputTokens: recent.outputTokens,
                contextTokens: recent.contextTokens,
              }
            : null,
        },
        securityAudit: status?.securityAudit?.summary || null,
        nodeService: status?.nodeService || null,
      },
    };
  }

  function taskStatsResponseBody(taskStats) {
    if (!taskStats) {
      return null;
    }

    return {
      code: 0,
      message: "ok",
      data: {
        total: taskStats.totalTasks ?? taskStats.taskCount ?? 0,
        todo: taskStats.todo ?? 0,
        doing: taskStats.doing ?? 0,
        blocked: taskStats.blocked ?? 0,
        done: taskStats.done ?? 0,
        taskList: taskStats.currentTask
          ? (Array.isArray(taskStats.taskList) && taskStats.taskList.length > 0
            ? taskStats.taskList.map((task) => ({
                taskId: task.taskId || "",
                agentId: task.agentId || "",
                assignee: task.assignee || "",
                sessionKey: task.sessionKey || "",
                title: task.title || "",
                status: task.status || "",
                progress: task.progress ?? 0,
                updatedAt: task.updatedAt || "",
                failureReason: task.failureReason || "",
                lastError: task.lastError || "",
                availableActions: Array.isArray(task.availableActions) ? task.availableActions : [],
              }))
            : [{
                taskId: taskStats.currentTask.taskId || "",
                agentId: taskStats.currentTask.agentId || "",
                assignee: taskStats.currentTask.assignee || "",
                sessionKey: taskStats.currentTask.sessionKey || "",
                title: taskStats.currentTask.title || "",
                status: taskStats.currentTask.status || "",
                progress: taskStats.currentTask.progress ?? 0,
                updatedAt: taskStats.currentTask.updatedAt || "",
                failureReason: taskStats.currentTask.failureReason || "",
                lastError: taskStats.currentTask.lastError || "",
                availableActions: Array.isArray(taskStats.currentTask.availableActions) ? taskStats.currentTask.availableActions : [],
              }])
          : [],
        page: 1,
        pageSize: taskStats.currentTask ? 1 : 0,
      },
    };
  }

  function taskRuntimeResponseBody(taskRuntime) {
    if (!taskRuntime) {
      return null;
    }

    return {
      code: 0,
      message: "ok",
      data: {
        currentTask: taskRuntime.currentTask
          ? {
              taskId: taskRuntime.currentTask.taskId || "",
              agentId: taskRuntime.currentTask.agentId || "",
              assignee: taskRuntime.currentTask.assignee || "",
              sessionKey: taskRuntime.currentTask.sessionKey || "",
              title: taskRuntime.currentTask.title || "",
              status: taskRuntime.currentTask.status || "",
              startedAt: taskRuntime.currentTask.startedAt || "",
              progress: taskRuntime.currentTask.progress ?? 0,
              etaSeconds: taskRuntime.currentTask.etaSeconds ?? null,
              failureReason: taskRuntime.currentTask.failureReason || "",
              lastError: taskRuntime.currentTask.lastError || "",
              availableActions: Array.isArray(taskRuntime.currentTask.availableActions) ? taskRuntime.currentTask.availableActions : [],
            }
          : null,
        nextTask: taskRuntime.nextTask
          ? {
              taskId: taskRuntime.nextTask.taskId || "",
              agentId: taskRuntime.nextTask.agentId || "",
              assignee: taskRuntime.nextTask.assignee || "",
              sessionKey: taskRuntime.nextTask.sessionKey || "",
              title: taskRuntime.nextTask.title || "",
              status: taskRuntime.nextTask.status || "",
              scheduledAt: taskRuntime.nextTask.scheduledAt || "",
            }
          : null,
        queueSummary: {
          queued: taskRuntime.queueSummary?.queued ?? 0,
          running: taskRuntime.queueSummary?.running ?? 0,
          failed: taskRuntime.queueSummary?.failed ?? 0,
        },
      },
    };
  }

  return {
    deriveTaskRuntimeFromPayload,
    deriveTaskStatsFromPayload,
    deriveTaskStatsFromStatus,
    synthesizeTaskRuntimeFromTaskStats,
    taskRuntimeResponseBody,
    taskStatsResponseBody,
    toDashboardPayload,
  };
}

module.exports = {
  createDashboardHelpers,
};
