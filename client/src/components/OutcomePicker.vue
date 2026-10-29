<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { CircleCheck, LoaderCircle } from '@lucide/vue';
import type { OutcomeValue } from '../../../shared/schemas';
import type { OutcomeState } from '../composables/useConversation';
import { OUTCOME_OPTIONS, type OutcomeOption } from '../lib/presentation';
import OutcomeCelebration from './OutcomeCelebration.vue';

const props = defineProps<{ options: OutcomeOption[]; state: OutcomeState; disabled: boolean }>();
const emit = defineEmits<{ select: [value: OutcomeValue] }>();

const titleId = useId();

// Celebrate only a choice made just now, not one that was already recorded when this turn rendered.
const editing = ref(false);
const justRecorded = ref(false);
watch(
  () => props.state.recorded,
  (value, previous) => {
    if (value === previous) return;
    editing.value = false;
    justRecorded.value = value !== null;
  },
);

const celebrated = computed(() => {
  const option = OUTCOME_OPTIONS.find((o) => o.value === props.state.recorded);
  return option?.celebration ? { ...option, celebration: option.celebration } : null;
});
const showCelebration = computed(() => celebrated.value && !editing.value && !props.state.error);

function choose(value: OutcomeValue) {
  if (value === props.state.recorded) {
    editing.value = false; // Re-picking the same option just closes the picker.
    return;
  }
  emit('select', value);
}
</script>

<template>
  <OutcomeCelebration
    v-if="showCelebration && celebrated"
    :key="celebrated.value"
    :option="celebrated"
    :animate="justRecorded"
    @change="editing = true"
  />

  <section v-else class="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-xs" :aria-labelledby="titleId">
    <h4 :id="titleId" class="text-sm font-semibold text-stone-800">I decided to…</h4>
    <p class="mt-0.5 text-xs text-stone-500">Optional — let us know what you chose.</p>
    <div class="mt-3 flex flex-wrap gap-2" role="group" :aria-labelledby="titleId">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-10"
        :class="
          state.recorded === o.value
            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
            : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:bg-emerald-50'
        "
        :aria-pressed="state.recorded === o.value"
        :disabled="disabled || state.saving !== null"
        @click="choose(o.value)"
      >
        <LoaderCircle v-if="state.saving === o.value" class="size-4 motion-safe:animate-spin" aria-hidden="true" />
        <component :is="o.icon" v-else class="size-4" aria-hidden="true" />
        {{ o.label }}
      </button>
    </div>
    <div aria-live="polite">
      <p v-if="state.error" class="mt-3 text-sm text-red-700">{{ state.error }}</p>
      <p
        v-else-if="state.recorded === 'undecided'"
        class="mt-3 flex items-start gap-1.5 text-sm text-stone-600 motion-safe:animate-fade"
      >
        <CircleCheck class="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
        No rush — take your time. Pick an option here whenever you decide.
      </p>
    </div>
  </section>
</template>
