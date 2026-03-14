<script setup>
const props = defineProps({
  state: {
    type: Object,
    default: () => ({
      visible: false,
      showRetry: false,
      showResolve: false,
      retryLabel: "重试任务",
      resolveLabel: "处理完成",
      disabled: false,
      note: "",
    }),
  },
});

const emit = defineEmits(["action"]);
</script>

<template>
  <div id="taskActions" class="task-actions" :hidden="!props.state.visible">
    <div class="task-actions__buttons">
      <button
        v-if="props.state.showRetry"
        id="retryTaskButton"
        type="button"
        class="task-action-btn"
        :disabled="props.state.disabled"
        @click="emit('action', 'retry')"
      >
        {{ props.state.retryLabel }}
      </button>
      <button
        v-if="props.state.showResolve"
        id="resolveTaskButton"
        type="button"
        class="task-action-btn task-action-btn--secondary"
        :disabled="props.state.disabled"
        @click="emit('action', 'resolve')"
      >
        {{ props.state.resolveLabel }}
      </button>
    </div>
    <p id="taskActionNote" class="task-actions__note">{{ props.state.note }}</p>
  </div>
</template>
