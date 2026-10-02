<script setup lang="ts">
import { computed } from 'vue'
import type { Txn } from '../lib/types'
import { catOf, fmt } from '../lib/money'
import { memberIds, myId, nm } from '../store'
import { dayMonth } from '../lib/util'
const props = defineProps<{ txn: Txn; mine?: boolean }>()
defineEmits<{ open: [] }>()
const cat = computed(() => catOf(props.txn.cat))
const splitText = computed(() =>
  props.txn.split.length === memberIds.value.length ? 'chia đều cả nhà' : 'chia cho ' + props.txn.split.map(nm).join(', ')
)
const myShare = computed(() => (props.txn.split.includes(myId.value) ? props.txn.amount / props.txn.split.length : 0))
</script>

<template>
  <button class="item" :style="{ '--c': cat.color }" @click="$emit('open')">
    <span class="stripe"></span>
    <span>
      <div class="t">{{ txn.title }}</div>
      <div class="d">{{ mine ? dayMonth(txn.date) + ' · ' : '' }}{{ nm(txn.payer) }} trả · {{ splitText }}</div>
    </span>
    <span class="a">
      {{ fmt(txn.amount) }}
      <small v-if="mine">{{ txn.payer === myId ? 'bạn trả' : 'phần bạn ' + fmt(myShare) }}</small>
    </span>
  </button>
</template>
