<script setup>
const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});
</script>

<template>
  <ol id="timelineList" class="timeline-list">
    <li
      v-for="item in props.items"
      :key="item.id"
      class="feed-item"
      :data-severity="item.severity"
    >
      <div class="feed-item__zone">{{ item.zone }}</div>
      <div class="feed-item__time">{{ item.time }}</div>
      <div class="feed-item__message">{{ item.message }}</div>
    </li>
  </ol>
</template>
