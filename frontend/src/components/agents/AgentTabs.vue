<script setup>
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
</script>

<template>
  <div id="agentTabs" class="agent-tabs">
    <button
      v-for="agent in props.agents"
      :key="agent.id"
      type="button"
      class="agent-tab"
      :class="{ 'is-active': agent.id === props.focusedAgentId }"
      :data-agent="agent.id"
      @click="emit('select', agent.id)"
    >
      {{ agent.id }}
    </button>
  </div>
</template>
