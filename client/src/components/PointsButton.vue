<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Gift } from '@lucide/vue';
import { computed } from 'vue';
import { useWallet } from '../composables/useWallet';
import RewardsPanel from './RewardsPanel.vue';

const { points, demoPoints, refresh } = useWallet();
const panel = ref<InstanceType<typeof RewardsPanel> | null>(null);

const label = computed(() => `Your points: ${points.value}${demoPoints.value ? `, demo points: ${demoPoints.value}` : ''}`);

onMounted(refresh);

function open() {
  void refresh();
  panel.value?.show();
}
</script>

<template>
  <button
    type="button"
    class="inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-stone-700 transition hover:bg-stone-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] sm:h-9 sm:w-auto sm:border sm:border-stone-200 sm:bg-white sm:px-3 sm:shadow-xs sm:hover:border-stone-300 sm:hover:bg-stone-100"
    :aria-label="label"
    :title="label"
    @click="open"
  >
    <Gift class="size-[18px] text-emerald-700 sm:size-4" aria-hidden="true" />
    <span class="hidden whitespace-nowrap sm:inline" aria-hidden="true">
      {{ points }} pts<template v-if="demoPoints"> <span class="text-amber-800">+ {{ demoPoints }} demo</span></template>
    </span>
  </button>
  <RewardsPanel ref="panel" />
</template>
