#!/usr/bin/env node

function stripProfile(args) {
  if (args[0] === "--profile" && args[1]) {
    return args.slice(2);
  }
  return args;
}

function writeJson(payload) {
  process.stdout.write(JSON.stringify(payload));
}

const args = stripProfile(process.argv.slice(2));

if (args[0] === "status" && args[1] === "--json") {
  writeJson({
    heartbeat: {
      defaultAgentId: "main",
      agents: [
        {
          agentId: "main",
          enabled: true,
          every: "30m",
          everyMs: 1800000,
        },
      ],
    },
    channelSummary: ["Telegram: configured"],
    queuedSystemEvents: [],
    sessions: {
      count: 2,
      recent: [
        {
          key: "agent:main:test",
          updatedAt: 1772993644883,
        },
      ],
    },
    gateway: {
      reachable: true,
    },
  });
  process.exit(0);
}

if (args[0] === "health" && args[1] === "--json") {
  writeJson({
    ok: true,
    ts: 1772993644883,
    durationMs: 12,
    channels: {},
    defaultAgentId: "main",
  });
  process.exit(0);
}

if (args[0] === "cron" && args[1] === "list" && args[2] === "--json") {
  writeJson({
    jobs: [
      { id: "job-1", enabled: true },
      { id: "job-2", enabled: false },
    ],
    total: 2,
    offset: 0,
    limit: 2,
    hasMore: false,
  });
  process.exit(0);
}

if (args[0] === "cron" && args[1] === "status" && args[2] === "--json") {
  writeJson({
    ok: true,
    jobs: [
      { id: "job-1", enabled: true, state: { lastRunStatus: "ok" } },
      { id: "job-2", enabled: false, state: {} },
    ],
  });
  process.exit(0);
}

if (args[0] === "sessions" && args.includes("--json")) {
  writeJson({
    count: 2,
    recent: [
      { key: "agent:main:test", updatedAt: 1772993644883 },
    ],
  });
  process.exit(0);
}

if (args[0] === "agent" && args.includes("--json")) {
  writeJson({
    ok: true,
    message: "mocked agent turn",
  });
  process.exit(0);
}

if (args[0] === "cron" && ["run", "enable", "disable", "rm"].includes(args[1]) && args.at(-1) === "--json") {
  writeJson({
    ok: true,
    action: args[1],
    jobId: args[2] || "",
  });
  process.exit(0);
}

process.stderr.write(`Unsupported mock openclaw args: ${args.join(" ")}\n`);
process.exit(1);
