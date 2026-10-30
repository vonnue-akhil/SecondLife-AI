<script setup lang="ts">
import { computed } from 'vue';
import type { Confidence } from '../../../shared/schemas';
import { CONFIDENCE_META } from '../lib/presentation';

const props = defineProps<{ confidence: Confidence }>();
const meta = computed(() => CONFIDENCE_META[props.confidence]);
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"
    :class="meta.pill"
  >
    <span class="flex items-end gap-px" aria-hidden="true">
      <span
        v-for="n in 3"
        :key="n"
        class="w-[3px] rounded-full bg-current"
        :class="[n <= meta.level ? '' : 'opacity-25', ['h-1.5', 'h-2', 'h-2.5'][n - 1]]"
      />
    </span>
    {{ meta.label }}
  </span>
</template>
