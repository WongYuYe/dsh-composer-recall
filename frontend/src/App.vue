<script setup>
import { computed } from "vue";

import AgentOverview from "./components/agents/AgentOverview.vue";
import AgentTabs from "./components/agents/AgentTabs.vue";
import TimelinePanel from "./components/debug/TimelinePanel.vue";
import PhaserMapPanel from "./components/map/PhaserMapPanel.vue";
import TaskActions from "./components/tasks/TaskActions.vue";
import { useOpenClawDashboard } from "./composables/useOpenClawDashboard.js";

const dashboard = useOpenClawDashboard();

const activeZone = computed(() => dashboard.viewState.value?.zone || "");
const alertData = computed(() => dashboard.viewState.value?.alertLevel || "OFFLINE");
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
          <p class="eyebrow">OPENCLAW RUNTIME</p>
          <h1>Pokemon Claw 运行看板</h1>
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

      <PhaserMapPanel :map-state="dashboard.phaserState.value" :banner-text="dashboard.mapBanner.value" />
    </main>

    <aside class="sidebar">
      <section class="sidebar-card panel sidebar-card--hero">
        <div class="sidebar-head">
          <div>
            <p class="eyebrow">任务总览</p>
            <h2>当前状态</h2>
          </div>
          <div class="sidebar-head__meta">
            <span id="syncBadge" :class="dashboard.syncBadgeClass.value" data-field="sync-badge">
              {{ dashboard.syncBadgeText.value }}
            </span>
            <span id="runModeChip" class="mode-chip">runtime</span>
            <span id="clock" class="clock">{{ dashboard.clockText.value }}</span>
          </div>
        </div>

        <div class="mission-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">当前视角</p>
              <h2 id="zoneName" data-field="zone-name">{{ dashboard.zoneName.value }}</h2>
            </div>
          </div>

          <AgentTabs
            :agents="dashboard.agents.value"
            :focused-agent-id="dashboard.focusedAgentId.value"
            @select="dashboard.selectAgent"
          />

          <p id="taskName" class="mission-card__task" data-field="task-name">{{ dashboard.taskName.value }}</p>
          <p id="taskSummary" class="mission-card__summary">{{ dashboard.taskSummary.value }}</p>

          <div id="taskDetail" class="task-detail" :hidden="!dashboard.taskDetail.value.visible">
            <div class="task-detail__head">
              <span id="taskDetailStatus" class="agent-chip" :data-status="dashboard.taskDetail.value.status">
                {{ dashboard.taskDetail.value.status }}
              </span>
              <span id="taskDetailMeta" class="task-detail__meta">{{ dashboard.taskDetail.value.meta }}</span>
            </div>
            <div id="taskDetailTitle" class="task-detail__title">{{ dashboard.taskDetail.value.title }}</div>
            <div id="taskDetailSummary" class="task-detail__summary">{{ dashboard.taskDetail.value.summary }}</div>
          </div>

          <div id="criticalBanner" class="critical-banner" :hidden="!dashboard.criticalMessage.value">
            {{ dashboard.criticalMessage.value }}
          </div>

          <TaskActions :state="dashboard.taskActions.value" @action="dashboard.performTaskAction" />
        </div>
      </section>

      <section class="sidebar-card panel telemetry-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">角色总览</p>
            <h2>四个 Agent 状态</h2>
          </div>
        </div>

        <AgentOverview
          :agents="dashboard.agents.value"
          :focused-agent-id="dashboard.focusedAgentId.value"
          @select="dashboard.selectAgent"
        />

        <dl class="metric-grid metric-grid--summary metric-grid--minimal">
          <div class="metric-box metric-box--highlight">
            <dt>模式</dt>
            <dd id="modeValue">{{ dashboard.modeValue.value }}</dd>
          </div>
          <div class="metric-box metric-box--highlight">
            <dt>告警</dt>
            <dd id="alertValue" :data-alert="alertData">{{ dashboard.alertValue.value }}</dd>
          </div>
          <div class="metric-box">
            <dt>队列</dt>
            <dd id="queueValue">{{ dashboard.queueValue.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="sidebar-card panel debug-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">事件流</p>
            <h2>最近变化</h2>
          </div>
        </div>

        <div class="debug-card__section">
          <div class="ops-card__subhead">
            <p class="eyebrow">状态判断</p>
          </div>
          <div id="recentSummary" class="debug-summary">{{ dashboard.recentSummary.value }}</div>
        </div>

        <div class="debug-card__section">
          <div class="ops-card__subhead">
            <p class="eyebrow">主事件流</p>
          </div>
          <TimelinePanel :items="dashboard.timelineItems.value" />
        </div>
      </section>
    </aside>
  </div>
</template>
