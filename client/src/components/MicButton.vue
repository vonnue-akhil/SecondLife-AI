<script setup lang="ts">
import { computed } from 'vue';
import { LoaderCircle, Mic, Square, X } from '@lucide/vue';
import { MAX_RECORD_SECONDS } from '../lib/audio';
import { useVoiceInput } from '../composables/useVoiceInput';

const props = defineProps<{ disabled?: boolean }>();

const { supported, state, elapsed, error, start, stop, cancel, clearError } = useVoiceInput();

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const elapsedLabel = computed(() => clock(elapsed.value));
const limitLabel = clock(MAX_RECORD_SECONDS);
</script>

<template>
  <div v-if="supported" class="relative flex items-center">
    <div
      v-if="state === 'recording'"
      class="flex h-11 items-center gap-1 rounded-full bg-red-50 pr-1 pl-3 text-sm text-red-800 motion-safe:animate-fade"
      role="status"
    >
      <span class="relative flex size-2.5" aria-hidden="true">
        <span class="absolute inline-flex size-full rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
        <span class="relative inline-flex size-2.5 rounded-full bg-red-600" />
      </span>
      <span class="ml-1 font-medium tabular-nums" :aria-label="`Recording, ${elapsed} seconds`">
        {{ elapsedLabel }}<span class="text-red-800/60"> / {{ limitLabel }}</span>
      </span>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-full text-red-700 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600"
        aria-label="Stop recording and transcribe"
        title="Stop and transcribe"
        @click="stop()"
      >
        <Square class="size-4 fill-current" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-full text-stone-500 transition hover:bg-red-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-red-600"
        aria-label="Cancel recording"
        title="Discard recording"
        @click="cancel()"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </div>

    <div v-else-if="state === 'transcribing'" class="flex h-11 items-center gap-2 px-3 text-sm text-stone-600" role="status">
      <LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
      Transcribing…
    </div>

    <button
      v-else
      type="button"
      class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
      :disabled="props.disabled || state === 'starting'"
      aria-label="Speak instead of typing"
      title="Speak instead of typing"
      @click="start()"
    >
      <LoaderCircle v-if="state === 'starting'" class="size-5 motion-safe:animate-spin" aria-hidden="true" />
      <Mic v-else class="size-5" aria-hidden="true" />
    </button>

    <p
      v-if="error"
      role="alert"
      class="absolute bottom-full left-0 z-10 mb-2 flex w-64 max-w-[80vw] items-start gap-2 rounded-xl border border-red-200 bg-white p-2.5 text-xs leading-snug text-red-700 shadow-md motion-safe:animate-fade"
    >
      <span class="flex-1">{{ error }}</span>
      <button type="button" class="-m-1 grid size-6 shrink-0 place-items-center rounded-full hover:bg-red-50" aria-label="Dismiss" @click="clearError()">
        <X class="size-3.5" aria-hidden="true" />
      </button>
    </p>
  </div>
</template>
