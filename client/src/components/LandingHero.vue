<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { ShieldCheck, Sprout } from '@lucide/vue';
import BrandMark from './BrandMark.vue';
import ChatComposer from './ChatComposer.vue';
import ImpactPaths from './ImpactPaths.vue';
import SamplePhotos from './SamplePhotos.vue';
import SuggestedPrompts from './SuggestedPrompts.vue';

defineProps<{ busy: boolean }>();
defineEmits<{ prompt: [text: string] }>();

const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
const composerWrap = ref<HTMLElement | null>(null);

/** After a sample is attached, bring the composer (photo + prefilled question) into view. */
function onSamplePicked() {
  nextTick(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    composerWrap.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    if (window.matchMedia('(pointer: fine)').matches) composer.value?.focus();
  });
}
</script>

<template>
  <section
    class="relative isolate mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pt-6 pb-8 sm:pt-14"
    aria-labelledby="hero-title"
  >
    <div class="bg-dawn pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]" aria-hidden="true" />

    <div class="flex flex-col items-center text-center motion-safe:animate-rise">
      <span class="relative inline-grid place-items-center">
        <span class="absolute inset-0 rounded-3xl bg-emerald-400/40 blur-xl motion-safe:animate-breathe" aria-hidden="true" />
        <BrandMark size="lg" class="relative" />
      </span>
      <p
        class="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/80 backdrop-blur-sm sm:text-[13px]"
      >
        <Sprout class="size-3.5 sm:size-4" aria-hidden="true" />
        Today’s good deed starts in your drawer
      </p>
      <h1
        id="hero-title"
        class="mx-auto mt-3 max-w-2xl text-[1.875rem] leading-[1.15] font-semibold tracking-tight text-balance text-stone-900 sm:text-5xl sm:leading-[1.1]"
      >
        Give your device a second life,
        <span class="bg-linear-to-r from-emerald-700 via-emerald-600 to-lime-600 bg-clip-text text-transparent">
          and the planet a better one
        </span>
      </h1>
      <p class="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-pretty text-stone-600 sm:mt-4 sm:text-lg">
        That old phone, TV, laptop, speaker or appliance can still help someone, or give back the metals inside it. Tell
        me about it, snap a photo or share a short clip, and I’ll find its best next life — safely.
      </p>
    </div>

    <div id="composer" ref="composerWrap" class="mt-6 scroll-my-24 sm:mt-8 motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
      <ChatComposer ref="composer" variant="hero" autofocus />
    </div>

    <div class="mt-4 motion-safe:animate-rise motion-safe:[animation-delay:140ms]">
      <SuggestedPrompts :disabled="busy" @select="$emit('prompt', $event)" />
    </div>

    <div class="mt-7 motion-safe:animate-rise motion-safe:[animation-delay:200ms]">
      <SamplePhotos :disabled="busy" @picked="onSamplePicked" />
    </div>

    <div class="mt-10 motion-safe:animate-rise motion-safe:[animation-delay:260ms]">
      <ImpactPaths />
    </div>

    <p class="mx-auto mt-8 max-w-md text-center text-xs leading-relaxed text-pretty text-stone-500">
      <ShieldCheck class="mr-1 inline size-3.5 align-[-2px] text-emerald-600" aria-hidden="true" />
      Your photos and videos are stripped of location data on your device before upload, and photos, videos and voice
      recordings are never stored. Guidance is general advice, not a professional diagnosis.
    </p>
  </section>
</template>
