<script setup lang="ts">
import { ArrowUpRight, Check, Earth, ShieldCheck, Sparkles } from '@lucide/vue';
import { EWASTE_MONITOR_URL, type OutcomeOption } from '../lib/presentation';

defineProps<{
  option: OutcomeOption & { celebration: NonNullable<OutcomeOption['celebration']> };
  /** Plays the pop and confetti; false when the choice was already recorded before this view appeared. */
  animate: boolean;
}>();
defineEmits<{ change: [] }>();

// Confetti evenly spread around the badge, alternating near and far so the burst doesn't look like a ring.
const COLOURS = ['#10b981', '#84cc16', '#f59e0b', '#0ea5e9', '#34d399', '#a3e635'];
const COUNT = 18;
const particles = Array.from({ length: COUNT }, (_, i) => {
  const angle = (i / COUNT) * 2 * Math.PI;
  const distance = [56, 84, 70][i % 3]!;
  return {
    x: `${Math.round(Math.cos(angle) * distance)}px`,
    y: `${Math.round(Math.sin(angle) * distance)}px`,
    r: `${(i % 3) * 120 + 90}deg`,
    colour: COLOURS[i % COLOURS.length],
    shape: i % 3 === 0 ? 'size-2 rounded-full' : i % 2 ? 'h-2.5 w-1.5 rounded-xs' : 'size-2.5 rounded-xs',
  };
});
</script>

<template>
  <section
    class="relative rounded-2xl border border-emerald-200 bg-white shadow-sm shadow-emerald-900/5"
    :class="{ 'motion-safe:animate-rise': animate }"
    aria-live="polite"
  >
    <!-- Banner: the decision, framed as a contribution. -->
    <div
      class="relative rounded-t-[calc(1rem-1px)] bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 px-4 py-5 text-white sm:px-5"
    >
      <!-- Clipped separately so the confetti can still burst past the banner. -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[inherit]" aria-hidden="true">
        <Earth class="absolute -right-8 -bottom-14 size-44 text-white/10" :stroke-width="1" />
      </div>

      <div class="relative flex items-start gap-4">
        <div class="relative mt-0.5 shrink-0">
          <template v-if="animate">
            <span
              class="absolute inset-0 rounded-2xl bg-emerald-300 motion-safe:animate-ring motion-reduce:hidden"
              aria-hidden="true"
            />
            <span
              v-for="(p, i) in particles"
              :key="i"
              class="absolute top-1/2 left-1/2 z-10 motion-safe:animate-burst motion-reduce:hidden"
              :class="p.shape"
              :style="{ '--x': p.x, '--y': p.y, '--r': p.r, backgroundColor: p.colour }"
              aria-hidden="true"
            />
          </template>
          <div
            class="relative grid size-14 place-items-center rounded-2xl bg-white text-emerald-700 shadow-lg shadow-emerald-950/30"
            :class="{ 'motion-safe:animate-pop': animate }"
          >
            <component :is="option.icon" class="size-7" aria-hidden="true" />
          </div>
        </div>

        <div class="min-w-0">
          <p class="flex items-center gap-1 text-xs font-semibold tracking-wide text-emerald-100 uppercase">
            <Sparkles class="size-3.5" aria-hidden="true" />
            Decision noted
          </p>
          <h4 class="mt-1 text-lg leading-snug font-semibold text-balance sm:text-xl">
            {{ option.celebration.title }}
          </h4>
          <p class="mt-1 text-sm leading-relaxed text-emerald-50/90">{{ option.celebration.body }}</p>
        </div>
      </div>
    </div>

    <div class="px-4 pt-4 pb-2 sm:px-5">
      <h5 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">What your choice does</h5>
      <ul class="mt-2.5 space-y-2">
        <li
          v-for="(point, i) in option.celebration.impact"
          :key="point"
          class="flex items-start gap-2.5 text-sm leading-snug text-stone-700"
          :class="{ 'motion-safe:animate-rise': animate }"
          :style="animate ? { animationDelay: `${300 + i * 90}ms` } : undefined"
        >
          <span class="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <Check class="size-3.5" :stroke-width="2.6" aria-hidden="true" />
          </span>
          <span class="pt-px">{{ point }}</span>
        </li>
      </ul>

      <div
        class="mt-4 flex items-start gap-3 rounded-xl bg-linear-to-r from-emerald-50 to-lime-50 px-3.5 py-3 ring-1 ring-emerald-100"
      >
        <Earth class="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <p class="text-sm leading-relaxed text-stone-700">
          The world throws out more than 60 million tonnes of e-waste a year.
          <strong class="font-semibold text-stone-900">Your choice keeps one more device from going to waste — that’s how change adds up.</strong>
          <a
            :href="EWASTE_MONITOR_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-1 inline-flex items-center gap-0.5 text-xs whitespace-nowrap text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
          >
            Source
            <ArrowUpRight class="size-3" aria-hidden="true" />
          </a>
        </p>
      </div>

      <p
        v-if="option.celebration.reminder"
        class="mt-3 flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-700 ring-1 ring-stone-200"
      >
        <ShieldCheck class="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <span>{{ option.celebration.reminder }}</span>
      </p>

      <button
        type="button"
        class="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-stone-500 underline-offset-4 transition hover:text-stone-800 hover:underline"
        @click="$emit('change')"
      >
        Changed your mind? Pick another option
      </button>
    </div>
  </section>
</template>
