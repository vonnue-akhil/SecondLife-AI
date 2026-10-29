<script setup lang="ts">
import { computed } from 'vue';
import { Info } from '@lucide/vue';
import type { Recommendation } from '../../../shared/schemas';
import { ACTION_STYLES } from '../lib/presentation';

const props = defineProps<{ recommendation: Recommendation; compact?: boolean }>();
const style = computed(() => ACTION_STYLES[props.recommendation.action]);
</script>

<template>
  <div :class="compact ? 'space-y-4' : 'space-y-5'">
    <p class="leading-relaxed text-stone-700" :class="compact ? 'text-sm' : 'text-[15px]'">
      {{ recommendation.reason }}
    </p>

    <section>
      <h5 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">Next steps</h5>
      <ol class="mt-2.5 space-y-2.5">
        <li v-for="(step, i) in recommendation.nextSteps" :key="i" class="flex items-start gap-3">
          <span
            class="grid shrink-0 place-items-center rounded-full font-semibold tabular-nums"
            :class="[compact ? 'size-5 text-[11px]' : 'size-6 text-xs', style.solid]"
            aria-hidden="true"
          >
            {{ i + 1 }}
          </span>
          <span class="min-w-0 leading-relaxed text-stone-700" :class="compact ? 'text-sm' : 'pt-0.5 text-[15px]'">
            {{ step }}
          </span>
        </li>
      </ol>
    </section>

    <section v-if="recommendation.limitations.length" class="border-t border-stone-100 pt-3.5">
      <h5 class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-stone-400 uppercase">
        <Info class="size-3.5" aria-hidden="true" />
        Keep in mind
      </h5>
      <ul class="mt-1.5 space-y-1 text-sm leading-relaxed text-stone-500">
        <li v-for="(item, i) in recommendation.limitations" :key="i" class="flex gap-2">
          <span class="mt-2 size-1 shrink-0 rounded-full bg-stone-300" aria-hidden="true" />
          <span>{{ item }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
