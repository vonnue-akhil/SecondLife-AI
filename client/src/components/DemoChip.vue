<script setup lang="ts">
import { FlaskConical } from '@lucide/vue';

// Marks fictional demo partners, demo rewards and demo points. Always visible: demo data must never pass as real.
withDefaults(defineProps<{ label?: string; title?: string }>(), {
  label: 'Demo',
  title: 'Demo listing for the hackathon demo, not a real business',
});
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset"
    :title="title"
  >
    <FlaskConical class="size-3 shrink-0" aria-hidden="true" />
    {{ label }}
    <span class="sr-only">: {{ title }}</span>
  </span>
</template>
