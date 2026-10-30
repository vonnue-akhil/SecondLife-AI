<script setup lang="ts">
import { ref } from 'vue';
import { ArrowLeft } from '@lucide/vue';
import BrandMark from './BrandMark.vue';
import PartnerRegisterForm from './PartnerRegisterForm.vue';
import PartnerTools from './PartnerTools.vue';

const tools = ref<InstanceType<typeof PartnerTools> | null>(null);
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="pt-safe sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50">
      <div class="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
        <div class="flex items-center gap-2.5">
          <BrandMark />
          <span class="text-[15px] font-semibold tracking-tight whitespace-nowrap text-stone-900">SecondLife <span class="text-emerald-700">AI</span></span>
        </div>
        <a href="#/" class="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-700 hover:bg-stone-200/70 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:outline-none">
          <ArrowLeft class="size-4" aria-hidden="true" />
          Back to SecondLife
        </a>
      </div>
    </header>

    <main class="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6 sm:py-8">
      <div>
        <p class="text-sm font-semibold tracking-wide text-emerald-700 uppercase">For repair shops and collection points</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">Be the place people take their old devices</h1>
        <p class="mt-3 text-stone-600">
          Get listed for people nearby who are looking for a repair or a drop-off point. Confirm handovers so they earn points,
          and offer rewards to bring them through your door.
        </p>
      </div>

      <PartnerRegisterForm @registered="(c) => tools?.signIn(c)" />
      <PartnerTools ref="tools" />
    </main>
  </div>
</template>
