<script setup lang="ts">
import { useId } from 'vue';
import { ShieldCheck } from '@lucide/vue';

const titleId = useId();
const steps = [
  'Back up your photos, contacts and chats',
  'Sign out of your accounts — Google or Apple ID, WhatsApp, UPI and banking apps',
  'Remove the SIM and any memory card',
  'Factory reset the device',
];
</script>

<template>
  <section class="rounded-2xl border border-stone-200 bg-stone-100/80 px-4 py-3.5" :aria-labelledby="titleId">
    <div class="flex items-start gap-3">
      <span class="grid size-8 shrink-0 place-items-center rounded-xl bg-stone-800 text-white">
        <ShieldCheck class="size-[18px]" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <h4 :id="titleId" class="pt-1 text-sm leading-snug font-semibold text-stone-900">
          Protect your data before it leaves your hands
        </h4>
        <p class="mt-1 text-sm leading-snug text-stone-600">
          If it stores anything personal, such as a phone, laptop, tablet, smart TV, camera or smartwatch:
        </p>
        <ol class="mt-2 space-y-1.5 text-sm leading-snug text-stone-700">
          <li v-for="(step, i) in steps" :key="step" class="flex gap-2">
            <span class="w-4 shrink-0 font-semibold text-stone-500 tabular-nums" aria-hidden="true">{{ i + 1 }}.</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
