<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrandMark from './BrandMark.vue';

defineProps<{ withPhoto?: boolean; withVideo?: boolean }>();

// A live model can take most of a minute; reassure the user instead of looking stuck.
const slow = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => (timer = setTimeout(() => (slow.value = true), 8000)));
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="flex items-center gap-2.5 motion-safe:animate-fade" role="status">
    <BrandMark />
    <div class="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-white px-4 py-2.5 shadow-xs">
      <span class="flex items-center gap-1" aria-hidden="true">
        <span class="size-1.5 rounded-full bg-emerald-600 motion-safe:animate-dot" />
        <span class="size-1.5 rounded-full bg-emerald-600 motion-safe:animate-dot motion-safe:[animation-delay:150ms]" />
        <span class="size-1.5 rounded-full bg-emerald-600 motion-safe:animate-dot motion-safe:[animation-delay:300ms]" />
      </span>
      <span class="text-sm text-stone-500">
        <template v-if="slow">Still working on it — this can take up to a minute…</template>
        <template v-else>{{ withVideo ? 'Watching your clip…' : withPhoto ? 'Looking at your photo…' : 'Thinking…' }}</template>
      </span>
    </div>
  </div>
</template>
