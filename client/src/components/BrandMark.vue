<script setup lang="ts">
import { Leaf } from '@lucide/vue';

withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' });
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-grid shrink-0 place-items-center bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm ring-1 ring-emerald-700/20"
    :class="size === 'lg' ? 'size-14 rounded-2xl shadow-emerald-700/20 sm:size-16' : 'size-8 rounded-[10px]'"
  >
    <Leaf :class="size === 'lg' ? 'size-7 sm:size-8' : 'size-[18px]'" :stroke-width="2.2" />
  </span>
</template>
