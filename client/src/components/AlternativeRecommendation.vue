<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { ChevronDown } from '@lucide/vue';
import type { Recommendation, Resource } from '../../../shared/schemas';
import { ACTION_STYLES } from '../lib/presentation';
import ConfidenceBadge from './ConfidenceBadge.vue';
import RecommendationDetails from './RecommendationDetails.vue';
import PartnerSection from './PartnerSection.vue';
import ResourceLinks from './ResourceLinks.vue';

const props = defineProps<{ recommendation: Recommendation; resources: Resource[] }>();
const style = computed(() => ACTION_STYLES[props.recommendation.action]);
const hasPartners = computed(() => ['repair', 'donate', 'recycle'].includes(props.recommendation.action));
const open = ref(false);
const panelId = useId();
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border bg-white shadow-xs transition"
    :class="open ? 'border-stone-300' : 'border-stone-200 hover:border-stone-300'"
  >
    <button
      type="button"
      class="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <span class="grid size-9 shrink-0 place-items-center rounded-xl" :class="style.tile">
        <component :is="style.icon" class="size-[18px]" aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[11px] font-semibold tracking-wide uppercase" :class="style.text">{{ style.label }}</span>
        <span class="block text-[15px] leading-snug font-medium text-stone-900">{{ recommendation.title }}</span>
      </span>
      <span class="hidden shrink-0 sm:block"><ConfidenceBadge :confidence="recommendation.confidence" /></span>
      <ChevronDown
        class="size-5 shrink-0 text-stone-400 transition-transform duration-200 motion-reduce:transition-none"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>
    <div v-show="open" :id="panelId" class="border-t border-stone-100 px-3.5 pt-3.5 pb-4 motion-safe:animate-fade">
      <div class="mb-3 sm:hidden"><ConfidenceBadge :confidence="recommendation.confidence" /></div>
      <RecommendationDetails :recommendation="recommendation" compact />
      <div v-if="hasPartners && open" class="mt-4">
        <PartnerSection :action="(recommendation.action as 'repair' | 'donate' | 'recycle')" />
      </div>
      <div v-if="resources.length" class="mt-4">
        <h5 class="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Where to go</h5>
        <ResourceLinks :resources="resources" />
      </div>
    </div>
  </div>
</template>
