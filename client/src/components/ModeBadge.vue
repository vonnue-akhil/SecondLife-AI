<script setup lang="ts">
import { computed } from 'vue';
import { FlaskConical, Sparkles, WifiOff } from '@lucide/vue';
import type { ModeBadgeState } from '../lib/presentation';

const props = defineProps<{ state: ModeBadgeState }>();

const tone = computed(
  () =>
    ({
      demo: 'bg-amber-50 text-amber-800 ring-amber-200',
      live: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
      offline: 'bg-stone-100 text-stone-500 ring-stone-200',
      checking: 'bg-stone-100 text-stone-500 ring-stone-200',
    })[props.state.tone],
);
const icon = computed(() => ({ demo: FlaskConical, live: Sparkles, offline: WifiOff, checking: null })[props.state.tone]);
</script>

<template>
  <span
    class="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors"
    :class="tone"
    :title="state.detail"
  >
    <component :is="icon" v-if="icon" class="size-3.5 shrink-0" aria-hidden="true" />
    <span v-else class="size-1.5 shrink-0 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
    <span class="min-w-0 truncate sm:hidden">{{ state.short }}</span>
    <span class="hidden min-w-0 truncate sm:inline">{{ state.label }}</span>
    <span class="sr-only">. {{ state.detail }}</span>
  </span>
</template>
