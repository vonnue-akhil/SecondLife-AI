<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useConversation } from '../composables/useConversation';
import AssistantMessage from './AssistantMessage.vue';
import TypingIndicator from './TypingIndicator.vue';
import UserMessage from './UserMessage.vue';

const emit = defineEmits<{ reply: [text: string] }>();

const { entries, sending, lastAssistant, latestRecommendationId, outcome, canRetry, retry, recordOutcome } =
  useConversation();

const pendingWithPhoto = computed(() => {
  const last = entries.value[entries.value.length - 1];
  return last?.kind === 'user' && last.status === 'sending' && !!last.photo;
});

// Screen readers get a short summary of each new reply rather than the whole card stack.
const announcement = ref('');
watch(lastAssistant, (entry) => {
  if (!entry) return;
  const t = entry.response.turn;
  const top = [...t.recommendations].sort((a, b) => a.rank - b.rank)[0];
  announcement.value = [
    `SecondLife AI: ${t.message}`,
    t.safetyWarnings.length ? `Safety warning: ${t.safetyWarnings.join(' ')}` : '',
    t.followUpQuestion ?? '',
    top ? `Top recommendation: ${top.title}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
});

const itemEls = new Map<string, HTMLElement>();
function setItemEl(id: string, el: unknown) {
  if (el instanceof HTMLElement) itemEls.set(id, el);
  else itemEls.delete(id);
}

function behavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

// New user message or typing indicator: go to the bottom. New reply: bring its start into
// view so long recommendation cards are read from the top.
watch(
  () => [entries.value.length, sending.value] as const,
  async ([len], prev) => {
    await nextTick();
    const last = entries.value[len - 1];
    if (!last) return;
    if (last.kind === 'assistant' && len > (prev?.[0] ?? 0)) {
      itemEls.get(last.id)?.scrollIntoView({ behavior: behavior(), block: 'start' });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: behavior() });
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-7" aria-label="Conversation">
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <div v-for="entry in entries" :key="entry.id" :ref="(el) => setItemEl(entry.id, el)" class="scroll-mt-20">
      <UserMessage
        v-if="entry.kind === 'user'"
        :entry="entry"
        :can-retry="canRetry(entry.id)"
        :retry-disabled="sending"
        @retry="retry(entry.id)"
      />
      <AssistantMessage
        v-else
        :entry="entry"
        :is-latest="entry.id === lastAssistant?.id"
        :show-outcome="entry.id === latestRecommendationId"
        :busy="sending"
        :outcome="outcome"
        @reply="emit('reply', $event)"
        @outcome="recordOutcome($event)"
      />
    </div>
    <TypingIndicator v-if="sending" :with-photo="pendingWithPhoto" />
  </section>
</template>
