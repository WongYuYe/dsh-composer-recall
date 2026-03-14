<script setup>
import { zoneLabels } from "../../lib/dashboard-config.js";

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
  if (Number.isFinite(age)) {
    return `${agent.status || "idle"} · ${Math.round(age / 1000)} 秒前活跃`;
  }

  return agent.status || "idle";
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
          {{ agent.session?.key || (agent.enabled === false ? "已停用" : "待命") }}
        </div>
      </button>
    </div>
  </div>
</template>
