<script setup lang="ts">
import { computed } from 'vue';
import type { Recommendation, Resource } from '../../../shared/schemas';
import { assignResources, byRank } from '../lib/presentation';
import AlternativeRecommendation from './AlternativeRecommendation.vue';
import PrimaryRecommendation from './PrimaryRecommendation.vue';
import PrivacyReminder from './PrivacyReminder.vue';
import ResourceLinks from './ResourceLinks.vue';

const props = defineProps<{ recommendations: Recommendation[]; resources: Resource[] }>();

const ranked = computed(() => byRank(props.recommendations));
const primary = computed(() => ranked.value[0]!);
const alternatives = computed(() => ranked.value.slice(1));
const assigned = computed(() => assignResources(props.recommendations, props.resources));

// The data-wipe reminder sits right after the highest-ranked donate/resell option.
const handsOver = (r: Recommendation) => r.action === 'donate' || r.action === 'resell';
const privacyAfterPrimary = computed(() => handsOver(primary.value));
const privacyAfterAlternatives = computed(() => !privacyAfterPrimary.value && alternatives.value.some(handsOver));
</script>

<template>
  <div class="space-y-4">
    <PrimaryRecommendation :recommendation="primary" :resources="assigned.byRank.get(primary.rank) ?? []" />

    <PrivacyReminder v-if="privacyAfterPrimary" />

    <section v-if="alternatives.length">
      <h4 class="mb-2.5 text-sm font-semibold text-stone-700">Other options</h4>
      <ul class="space-y-2">
        <li v-for="rec in alternatives" :key="rec.rank">
          <AlternativeRecommendation :recommendation="rec" :resources="assigned.byRank.get(rec.rank) ?? []" />
        </li>
      </ul>
    </section>

    <PrivacyReminder v-if="privacyAfterAlternatives" />

    <section v-if="assigned.unassigned.length">
      <h4 class="mb-2.5 text-sm font-semibold text-stone-700">More resources</h4>
      <ResourceLinks :resources="assigned.unassigned" />
    </section>
  </div>
</template>
