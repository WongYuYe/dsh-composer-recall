<script setup>
import { computed } from "vue";

import AgentOverview from "./components/agents/AgentOverview.vue";
import PhaserMapPanel from "./components/map/PhaserMapPanel.vue";
import TaskActions from "./components/tasks/TaskActions.vue";
import { useOpenClawDashboard } from "./composables/useOpenClawDashboard.js";

const dashboard = useOpenClawDashboard();

const activeZone = computed(() => dashboard.viewState.value?.zone || "");
const zonePills = [
  { id: "rest", label: "休息区" },
  { id: "work", label: "工作区" },
  { id: "alarm", label: "警报区" },
];
</script>

<template>
  <div class="app-shell">
    <main id="mapHome" class="map-home" :data-zone="activeZone || 'none'">
      <header class="map-header panel">
        <div>
          <h1>Pokemon Claw</h1>
        </div>
        <div class="zone-pills">
          <span
            v-for="zone in zonePills"
            :key="zone.id"
            class="zone-pill"
            :class="{ 'is-active': activeZone === zone.id }"
            :data-zone="zone.id"
          >
            {{ zone.label }}
          </span>
        </div>
      </header>

      <PhaserMapPanel
        :map-state="dashboard.phaserState.value"
        :banner-text="dashboard.mapBanner.value"
      />
    </main>

    <aside class="sidebar">
      <section class="sidebar-card panel sidebar-card--hero">
        <div class="sidebar-head">
          <div>
            <h2>当前状态</h2>
          </div>
          <div class="sidebar-head__meta">
            <span
              id="syncBadge"
              :class="dashboard.syncBadgeClass.value"
              data-field="sync-badge"
            >
              {{ dashboard.syncBadgeText.value }}
            </span>
            <span id="clock" class="clock">{{ dashboard.clockText.value }}</span>
          </div>
        </div>

        <div class="mission-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">当前视角</p>
              <h2 id="zoneName" data-field="zone-name">
                {{ dashboard.zoneName.value }}
              </h2>
            </div>
          </div>

          <p id="taskName" class="mission-card__task" data-field="task-name">
            {{ dashboard.taskName.value }}
          </p>
          <p id="taskSummary" class="mission-card__summary">
            {{ dashboard.taskSummary.value }}
          </p>

          <div
            id="taskDetail"
            class="task-detail"
            :hidden="!dashboard.taskDetail.value.visible"
          >
            <div class="task-detail__head">
              <span
                id="taskDetailStatus"
                class="agent-chip"
                :data-status="dashboard.taskDetail.value.status"
              >
                {{ dashboard.taskDetail.value.status }}
              </span>
              <span id="taskDetailMeta" class="task-detail__meta">
                {{ dashboard.taskDetail.value.meta }}
              </span>
            </div>
            <div id="taskDetailTitle" class="task-detail__title">
              {{ dashboard.taskDetail.value.title }}
            </div>
            <div id="taskDetailSummary" class="task-detail__summary">
              {{ dashboard.taskDetail.value.summary }}
            </div>
          </div>

          <div
            id="criticalBanner"
            class="critical-banner"
            :hidden="!dashboard.criticalMessage.value"
          >
            {{ dashboard.criticalMessage.value }}
          </div>

          <TaskActions
            :state="dashboard.taskActions.value"
            @action="dashboard.performTaskAction"
          />
        </div>
      </section>

      <section class="sidebar-card panel telemetry-card">
        <div class="card-heading">
          <div>
            <h2>Agent 总览</h2>
          </div>
        </div>

        <p
          v-if="dashboard.agentSummary.value.visible"
          class="telemetry-card__summary"
          :data-state="dashboard.agentSummary.value.state"
        >
          来源：{{ dashboard.agentSummary.value.sourceLabel }} · 已配置
          {{ dashboard.agentSummary.value.configuredCount }} · 活跃
          {{ dashboard.agentSummary.value.activeCount }}
        </p>

        <AgentOverview
          :agents="dashboard.agents.value"
          :focused-agent-id="dashboard.focusedAgentId.value"
          @select="dashboard.selectAgent"
        />
      </section>
    </aside>
  </div>
</template>
