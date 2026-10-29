<script setup lang="ts">
import { computed } from 'vue';
import { MessageCircleQuestion } from '@lucide/vue';
import type { OutcomeValue } from '../../../shared/schemas';
import type { AssistantEntry, OutcomeState } from '../composables/useConversation';
import { orderedOutcomes } from '../lib/presentation';
import BrandMark from './BrandMark.vue';
import DamageOverlay from './DamageOverlay.vue';
import OutcomePicker from './OutcomePicker.vue';
import QuickReplies from './QuickReplies.vue';
import Recommendations from './Recommendations.vue';
import SafetyBanner from './SafetyBanner.vue';

const props = defineProps<{
  entry: AssistantEntry;
  /** Quick replies are only offered on the newest assistant turn. */
  isLatest: boolean;
  showOutcome: boolean;
  busy: boolean;
  outcome: OutcomeState;
}>();
defineEmits<{ reply: [text: string]; outcome: [value: OutcomeValue] }>();

const response = computed(() => props.entry.response);
const turn = computed(() => response.value.turn);
const showCards = computed(() => turn.value.stage === 'recommending' && turn.value.recommendations.length > 0);
const showOverlay = computed(() => !!props.entry.photo && response.value.damageRegions.length > 0);
const replies = computed(() => (props.isLatest ? turn.value.quickReplies : []));
const outcomeOptions = computed(() => orderedOutcomes(turn.value.recommendations));
</script>

<template>
  <article class="motion-safe:animate-rise" aria-label="SecondLife AI replied">
    <div class="flex items-center gap-2.5">
      <BrandMark />
      <h3 class="text-sm font-semibold text-stone-800">SecondLife AI</h3>
    </div>

    <div class="mt-2.5 space-y-4 sm:pl-[2.625rem]">
      <p
        class="w-fit max-w-full rounded-3xl rounded-tl-lg border border-stone-200 bg-white px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-stone-800 shadow-xs sm:text-base"
      >
        {{ turn.message }}
      </p>

      <DamageOverlay
        v-if="showOverlay && entry.photo"
        :photo="entry.photo"
        :regions="response.damageRegions"
        :segmentation="response.providers.segmentation"
      />

      <SafetyBanner v-if="turn.safetyWarnings.length" :warnings="turn.safetyWarnings" />

      <section
        v-if="turn.followUpQuestion"
        class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
        aria-label="Follow-up question"
      >
        <div class="flex items-start gap-3">
          <MessageCircleQuestion class="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <p class="min-w-0 flex-1 text-[15px] leading-relaxed font-semibold text-stone-900 sm:text-base">
            {{ turn.followUpQuestion }}
          </p>
        </div>
        <QuickReplies
          v-if="replies.length"
          class="mt-3 sm:pl-8"
          :replies="replies"
          :disabled="busy"
          @select="$emit('reply', $event)"
        />
      </section>

      <Recommendations v-if="showCards" :recommendations="turn.recommendations" :resources="response.resources" />

      <QuickReplies
        v-if="!turn.followUpQuestion && replies.length"
        :replies="replies"
        :disabled="busy"
        @select="$emit('reply', $event)"
      />

      <OutcomePicker
        v-if="showOutcome"
        :options="outcomeOptions"
        :state="outcome"
        :disabled="busy"
        @select="$emit('outcome', $event)"
      />

      <p v-if="showCards" class="text-xs text-stone-400">
        General guidance based on what you’ve shared — not a professional diagnosis.
      </p>
    </div>
  </article>
</template>
