<script setup lang="ts">
import { computed } from 'vue';
import { CircleAlert, RotateCw } from '@lucide/vue';
import type { UserEntry } from '../composables/useConversation';

const props = defineProps<{ entry: UserEntry; canRetry: boolean; retryDisabled: boolean }>();
defineEmits<{ retry: [] }>();

const failed = computed(() => props.entry.status === 'failed');
const failureText = computed(() => {
  const err = props.entry.error;
  if (!err) return 'Not sent.';
  // Older failures were superseded by later messages; keep them short.
  return props.canRetry || !err.retryable ? err.message : 'Not sent.';
});
</script>

<template>
  <div class="flex flex-col items-end motion-safe:animate-rise">
    <h3 class="sr-only">You said</h3>
    <div class="flex max-w-[85%] flex-col items-end gap-1.5 sm:max-w-[75%]" :class="failed ? 'opacity-70' : ''">
      <img
        v-if="entry.photo"
        :src="entry.photo.url"
        :width="entry.photo.width || undefined"
        :height="entry.photo.height || undefined"
        :alt="entry.text ? 'Photo you attached of your device' : 'Photo you sent of your device'"
        class="block h-auto max-h-60 w-auto max-w-[14rem] rounded-3xl rounded-br-lg border border-stone-200 bg-stone-100 object-cover shadow-sm"
      />
      <p
        v-if="entry.text"
        class="rounded-3xl rounded-br-lg bg-emerald-700 px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-white shadow-sm"
      >
        {{ entry.text }}
      </p>
    </div>

    <div
      v-if="failed"
      class="mt-2 flex max-w-[92%] flex-col items-end gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm sm:max-w-[75%] sm:flex-row sm:items-center sm:gap-3 motion-safe:animate-fade"
      role="alert"
    >
      <p class="flex items-start gap-1.5 text-red-800">
        <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{{ failureText }}</span>
      </p>
      <button
        v-if="canRetry"
        type="button"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-sm font-medium text-red-700 shadow-xs transition hover:border-red-300 hover:bg-red-100 disabled:opacity-50 sm:min-h-9"
        :disabled="retryDisabled"
        @click="$emit('retry')"
      >
        <RotateCw class="size-3.5" aria-hidden="true" />
        Retry
      </button>
    </div>
  </div>
</template>
