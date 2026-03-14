<script setup>
import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

const props = defineProps({
  mapState: {
    type: Object,
    default: null,
  },
  bannerText: {
    type: String,
    default: "",
  },
});

const mapGridRef = ref(null);

function toPlain(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function syncMap() {
  if (!props.mapState) {
    return;
  }

  window.OpenClawPhaserTownMap?.apply?.(toPlain(props.mapState));
}

function handleResize() {
  window.OpenClawPhaserTownMap?.resize?.();
}

onMounted(() => {
  if (mapGridRef.value) {
    window.OpenClawPhaserTownMap?.init?.(mapGridRef.value);
  }
  syncMap();
  window.addEventListener("resize", handleResize);
  requestAnimationFrame(handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});

watch(
  () => props.mapState,
  () => {
    syncMap();
  },
  { deep: true },
);
</script>

<template>
  <section class="map-card panel">
    <div class="map-screen">
      <div class="map-scroller">
        <div class="map-world">
          <div
            id="mapGrid"
            ref="mapGridRef"
            class="map-grid map-grid--phaser"
            aria-label="Pokemon Claw 地图"
          ></div>
        </div>
      </div>

      <div class="map-bottom">
        <div id="mapBanner" class="map-banner" data-field="map-banner">
          {{ bannerText }}
        </div>

        <div class="map-legend">
          <span><i class="legend-chip legend-chip--rest"></i>休息区</span>
          <span><i class="legend-chip legend-chip--work"></i>工作区</span>
          <span><i class="legend-chip legend-chip--alarm"></i>警报区</span>
          <span><i class="legend-chip legend-chip--robot"></i>Agent 位置</span>
        </div>
      </div>
    </div>
  </section>
</template>
