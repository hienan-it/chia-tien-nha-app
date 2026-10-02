<script setup lang="ts">
import { computed, ref } from 'vue'
import { selectGroup, state } from '../store'
import { errMsg, initial, toast } from '../lib/util'

const emit = defineEmits<{ close: []; join: []; create: [] }>()

const tab = ref<'all' | 'owned'>('all')
const list = computed(() => (tab.value === 'all' ? state.groups : state.groups.filter((g) => g.is_admin)))
const busy = ref(false)

async function pick(gid: string) {
  if (gid === state.me?.group_id) return emit('close')
  busy.value = true
  try {
    await selectGroup(gid)
    emit('close')
  } catch (e) {
    toast(errMsg(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h3>Nhóm của bạn</h3>
  <div class="tabs" role="tablist">
    <button role="tab" :aria-selected="tab === 'all'" @click="tab = 'all'">Tất cả ({{ state.groups.length }})</button>
    <button role="tab" :aria-selected="tab === 'owned'" @click="tab = 'owned'">Nhóm của tôi</button>
  </div>

  <button v-for="g in list" :key="g.group_id" class="person" :disabled="busy" @click="pick(g.group_id)">
    <span class="avatar">{{ initial(g.group_name) }}</span>
    <span>
      <span class="pname">{{ g.group_name }}</span>
      <span class="psub" style="display: block">{{ g.is_admin ? 'Chủ nhóm' : 'Thành viên' }} · mã {{ g.invite_code }}</span>
    </span>
    <span v-if="g.group_id === state.me?.group_id" class="bal pos" aria-label="Đang xem">✓</span>
    <span v-else></span>
  </button>
  <p v-if="!list.length" class="none">{{ tab === 'owned' ? 'Bạn chưa tạo nhóm nào.' : 'Bạn chưa ở trong nhóm nào.' }}</p>

  <div class="row">
    <button @click="emit('join')">Tham gia nhóm</button>
    <button class="primary" @click="emit('create')">Tạo nhóm mới</button>
  </div>
</template>
