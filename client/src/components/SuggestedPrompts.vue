<script setup lang="ts">
import { BatteryWarning, Laptop, Smartphone, Tv, WashingMachine } from '@lucide/vue';

defineProps<{ disabled?: boolean }>();
defineEmits<{ select: [text: string] }>();

const prompts = [
  { text: 'What can I do with this old phone?', icon: Smartphone },
  { text: 'My laptop won’t turn on.', icon: Laptop },
  { text: 'Our old TV has lines on the screen.', icon: Tv },
  { text: 'The washing machine stopped spinning.', icon: WashingMachine },
  { text: 'How do I get rid of a dead power bank?', icon: BatteryWarning },
];
</script>

<template>
  <section aria-labelledby="suggested-title">
    <h2 id="suggested-title" class="sr-only">Suggested questions</h2>
    <ul class="flex flex-wrap justify-center gap-2">
      <li v-for="p in prompts" :key="p.text">
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-left text-sm text-stone-700 shadow-xs transition hover:-translate-y-px hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-stone-900 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 motion-reduce:hover:translate-y-0"
          :disabled="disabled"
          @click="$emit('select', p.text)"
        >
          <component :is="p.icon" class="size-4 shrink-0 text-emerald-700/70" aria-hidden="true" />
          {{ p.text }}
        </button>
      </li>
    </ul>
  </section>
</template>
