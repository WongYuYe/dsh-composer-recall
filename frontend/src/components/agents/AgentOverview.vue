<script setup>
import { zoneLabels } from "../../lib/dashboard-config.js";
import { formatStatusLabel } from "../../lib/dashboard-model.js";

const props = defineProps({
  agents: {
    type: Array,
    default: () => [],
  },
  focusedAgentId: {
    type: String,
    default: "main",
  },
});

const emit = defineEmits(["select"]);

function formatStatus(agent) {
  const age = Number(agent?.session?.age);
  const statusLabel = formatStatusLabel(agent?.status || "standby");

  if (Number.isFinite(age)) {
    return `${statusLabel} 路 ${Math.round(age / 1000)} 秒前活跃`;
  }

  return statusLabel;
}

function formatTaskLine(agent) {
  if (agent?.session?.key) {
    return agent.session.key;
  }

  if (agent?.enabled === false) {
    return "已停用";
  }

  return formatStatusLabel(agent?.status || "standby");
}
</script>

<template>
  <div>
    <div id="agentOverview" class="agent-overview">
      <button
        v-for="agent in props.agents"
        :key="`${agent.id}-mini`"
        type="button"
        class="agent-mini"
        :class="{ 'is-active': agent.id === props.focusedAgentId }"
        @click="emit('select', agent.id)"
      >
        <div class="agent-mini__name">{{ agent.id }}</div>
        <div class="agent-mini__meta">
          {{ zoneLabels[agent.zone] || agent.zone }} /
          {{ formatStatus(agent) }}
        </div>
        <div class="agent-mini__task">
          {{ formatTaskLine(agent) }}
        </div>
      </button>
    </div>
  </div>
</template>
