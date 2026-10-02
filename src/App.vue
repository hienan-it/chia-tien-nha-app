<script setup lang="ts">
import { state } from './store'
import { toastState } from './lib/util'
import AuthView from './components/AuthView.vue'
import Onboarding from './components/Onboarding.vue'
import MainView from './components/MainView.vue'
const reload = () => window.location.reload()
</script>

<template>
  <div v-if="!state.ready" class="wrap"><p class="none">Đang tải…</p></div>
  <div v-else-if="state.initError" class="wrap">
    <div class="onboard">
      <h2>Chưa kết nối được</h2>
      <p>{{ state.initError }}</p>
      <button class="btn" @click="reload">Thử lại</button>
    </div>
  </div>
  <AuthView v-else-if="!state.user || state.recovery" />
  <Onboarding v-else-if="!state.me" />
  <MainView v-else />
  <Transition name="fade">
    <div v-if="toastState.show" class="toast" role="status">{{ toastState.text }}</div>
  </Transition>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
