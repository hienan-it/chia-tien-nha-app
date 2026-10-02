<script setup lang="ts">
import { computed } from 'vue'
import { membersById } from '../store'
import { safeImage } from '../lib/image'
import { copyText } from '../lib/util'
const props = defineProps<{ memberId: string }>()
const m = computed(() => membersById.value[props.memberId])
const qr = computed(() => safeImage(m.value?.qr_data ?? ''))
</script>

<template>
  <div class="paybox">
    <p v-if="!m || (!m.acc && !qr)" class="hint" style="margin: 0">
      {{ m?.name ?? 'Người này' }} chưa thêm số tài khoản hay mã QR.
    </p>
    <template v-else>
      <img v-if="qr" class="qr" :src="qr" :alt="`Mã QR của ${m.name}`" />
      <div>
        <div v-if="m.acc" class="kv">
          <div><div class="k">Số tài khoản</div><div class="v">{{ m.acc }}</div></div>
          <button class="copy" @click="copyText(m.acc, 'số tài khoản')">Chép</button>
        </div>
        <div v-if="m.bank" class="kv">
          <div><div class="k">Ngân hàng</div><div class="v">{{ m.bank }}</div></div>
        </div>
        <div v-if="m.holder" class="kv">
          <div><div class="k">Chủ tài khoản</div><div class="v">{{ m.holder }}</div></div>
        </div>
      </div>
    </template>
  </div>
</template>
