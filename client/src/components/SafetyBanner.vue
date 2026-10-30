<script setup lang="ts">
import { useId } from 'vue';
import { OctagonAlert } from '@lucide/vue';

defineProps<{ warnings: string[] }>();
const titleId = useId();
</script>

<template>
  <section
    class="rounded-2xl border border-red-300 bg-red-50 p-4 shadow-sm ring-1 ring-red-600/10 sm:p-5"
    :aria-labelledby="titleId"
  >
    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-sm">
        <OctagonAlert class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <h4 :id="titleId" class="pt-1.5 text-base leading-tight font-semibold text-red-900">Safety first</h4>
        <ul class="mt-2 space-y-1.5 text-[15px] leading-relaxed text-red-900">
          <li v-for="(w, i) in warnings" :key="i" :class="warnings.length > 1 ? 'flex gap-2' : ''">
            <span v-if="warnings.length > 1" class="mt-2.5 size-1.5 shrink-0 rounded-full bg-red-600" aria-hidden="true" />
            <span>{{ w }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
