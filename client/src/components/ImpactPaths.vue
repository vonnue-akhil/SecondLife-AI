<script setup lang="ts">
import { ArrowUpRight, Earth } from '@lucide/vue';
import type { Action } from '../../../shared/schemas';
import { ACTION_STYLES, EWASTE_MONITOR_URL } from '../lib/presentation';

// Ordered like the waste hierarchy: keeping a device in use first, recycling last.
const paths: { action: Action; good: string }[] = [
  { action: 'repair', good: 'Keeps it running, so nothing new is made' },
  { action: 'reuse', good: 'Finds it a new job around the house' },
  { action: 'donate', good: 'Helps a student or family get connected' },
  { action: 'resell', good: 'Stays in use, and pays you back' },
  { action: 'recycle', good: 'Recovers metals and keeps toxins out of soil' },
];
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white/80 px-5 py-6 shadow-sm shadow-emerald-900/5 sm:px-7 sm:py-7"
    aria-labelledby="impact-title"
  >
    <Earth
      class="pointer-events-none absolute -top-10 -right-10 hidden size-52 text-emerald-100 sm:block"
      :stroke-width="1"
      aria-hidden="true"
    />

    <div class="relative">
      <h2 id="impact-title" class="text-xs font-semibold tracking-wide text-emerald-700 uppercase">Why it matters</h2>
      <p class="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">62 million tonnes</p>
      <p class="mt-1 max-w-md text-sm leading-relaxed text-pretty text-stone-600 sm:text-[15px]">
        of e-waste was thrown out worldwide in 2022, and less than a quarter of it was properly collected and recycled.
      </p>
      <a
        :href="EWASTE_MONITOR_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-1.5 inline-flex items-center gap-0.5 text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
      >
        Source: Global E-waste Monitor 2024
        <ArrowUpRight class="size-3" aria-hidden="true" />
      </a>
    </div>

    <div class="relative mt-6 border-t border-stone-100 pt-5">
      <h3 class="text-[15px] font-semibold text-stone-900">The greenest device is the one that’s already made</h3>
      <p class="mt-0.5 text-sm text-stone-500">
        So I’ll look for the first option that’s safe for yours — starting from the top.
      </p>

      <ol class="relative mt-4 grid gap-2 sm:grid-cols-5 sm:gap-3">
        <!-- The path connecting the steps on wide screens. -->
        <span
          class="absolute top-5 right-[10%] left-[10%] hidden border-t-2 border-dashed border-emerald-200 sm:block"
          aria-hidden="true"
        />
        <li
          v-for="(p, i) in paths"
          :key="p.action"
          class="relative flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center motion-safe:animate-rise"
          :style="{ animationDelay: `${260 + i * 60}ms` }"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-xl ring-4 ring-white"
            :class="ACTION_STYLES[p.action].tile"
          >
            <component :is="ACTION_STYLES[p.action].icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold" :class="ACTION_STYLES[p.action].text">
              {{ ACTION_STYLES[p.action].label }}
            </span>
            <span class="block text-[13px] leading-snug text-stone-600">{{ p.good }}</span>
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
