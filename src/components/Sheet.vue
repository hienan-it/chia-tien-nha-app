<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="scrim" :class="{ open }" @click="emit('close')"></div>
    <div class="sheet" :class="{ open }" role="dialog" aria-modal="true" :aria-hidden="!open">
      <slot />
    </div>
  </Teleport>
</template>
