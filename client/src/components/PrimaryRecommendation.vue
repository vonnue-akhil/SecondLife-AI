<script setup lang="ts">
import { computed } from 'vue';
import type { Recommendation, Resource } from '../../../shared/schemas';
import { ACTION_STYLES } from '../lib/presentation';
import ConfidenceBadge from './ConfidenceBadge.vue';
import RecommendationDetails from './RecommendationDetails.vue';
import ResourceLinks from './ResourceLinks.vue';

const props = defineProps<{ recommendation: Recommendation; resources: Resource[] }>();
const style = computed(() => ACTION_STYLES[props.recommendation.action]);
const urgent = computed(() => props.recommendation.action === 'stop_use');
</script>

<template>
  <article
    class="overflow-hidden rounded-3xl border bg-white shadow-sm shadow-stone-900/5"
    :class="[style.border, urgent ? 'ring-1 ring-red-600/15' : '']"
    :aria-label="`${urgent ? 'Urgent' : 'Top'} recommendation: ${recommendation.title}`"
  >
    <header class="border-b px-4 py-4 sm:px-5" :class="[style.surface, style.border]">
      <div class="flex items-start gap-3.5">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl" :class="style.tile">
          <component :is="style.icon" class="size-[22px]" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold tracking-wide uppercase" :class="style.text">
            {{ urgent ? 'Do this first' : 'Best option' }} · {{ style.label }}
          </p>
          <h4 class="mt-0.5 text-lg leading-snug font-semibold text-balance text-stone-900 sm:text-xl">
            {{ recommendation.title }}
          </h4>
          <div class="mt-2">
            <ConfidenceBadge :confidence="recommendation.confidence" />
          </div>
        </div>
      </div>
    </header>

    <div class="px-4 py-5 sm:px-5">
      <RecommendationDetails :recommendation="recommendation" />
    </div>

    <footer v-if="resources.length" class="border-t border-stone-100 bg-stone-50/70 px-4 py-4 sm:px-5">
      <h5 class="mb-2.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">Where to go</h5>
      <ResourceLinks :resources="resources" />
    </footer>
  </article>
</template>
