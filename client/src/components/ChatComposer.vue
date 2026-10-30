<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue';
import { ArrowUp, ImagePlus, LoaderCircle, Play, ShieldCheck, Video, X } from '@lucide/vue';
import { useComposer } from '../composables/useComposer';
import { useConversation } from '../composables/useConversation';
import { ACCEPTED_IMAGE_TYPES } from '../lib/image';
import { ACCEPTED_VIDEO_TYPES, formatDuration } from '../lib/video';
import { SAMPLE_PHOTOS } from '../lib/samples';
import LocationPicker from './LocationPicker.vue';
import MicButton from './MicButton.vue';

const props = withDefaults(defineProps<{ variant?: 'hero' | 'docked'; autofocus?: boolean }>(), {
  variant: 'docked',
  autofocus: false,
});

const MAX_LENGTH = 2000; // matches ChatFieldsSchema
const MAX_HEIGHT_PX = 200;

const { send, sending, supportsImages, supportsVideo, speechToText } = useConversation();
const { draft, attachment, attachError, isProcessing, hasAttachment, attachFile, removeAttachment, takeAttachment, clearError } =
  useComposer();

const textarea = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uid = useId();

const isHero = computed(() => props.variant === 'hero');
const canSend = computed(
  () => !sending.value && !isProcessing.value && (draft.value.trim().length > 0 || hasAttachment.value),
);
const acceptTypes = computed(() => (supportsVideo.value ? `${ACCEPTED_IMAGE_TYPES},${ACCEPTED_VIDEO_TYPES}` : ACCEPTED_IMAGE_TYPES));
const processingVideo = computed(() => attachment.value.status === 'processing' && attachment.value.isVideo);
const readyVideo = computed(() => {
  const a = attachment.value;
  return a.status === 'ready' ? a.video : null;
});
const showCount = computed(() => draft.value.length >= MAX_LENGTH * 0.8);
const sampleLabel = computed(() => {
  const a = attachment.value;
  const id = a.status === 'empty' ? null : a.sampleId;
  return id ? (SAMPLE_PHOTOS.find((s) => s.id === id)?.label ?? 'Sample photo') : null;
});

function resize() {
  const el = textarea.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
}
watch(draft, () => nextTick(resize));

function submit() {
  if (!canSend.value) return;
  const image = takeAttachment();
  if (send(draft.value, image)) {
    draft.value = '';
    nextTick(() => textarea.value?.focus({ preventScroll: true }));
  }
}

function onKeydown(e: KeyboardEvent) {
  // Enter sends; Shift+Enter (and IME composition) inserts a newline as usual.
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  submit();
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void attachFile(file, supportsVideo.value);
  input.value = ''; // allow picking the same file again
}

onMounted(() => {
  resize();
  if (props.autofocus && window.matchMedia('(pointer: fine)').matches) textarea.value?.focus();
});

defineExpose({ focus: () => textarea.value?.focus() });
</script>

<template>
  <div>
    <form
      class="rounded-[1.75rem] border border-stone-200 bg-white shadow-sm transition hover:border-stone-300 focus-within:border-emerald-500/70 focus-within:shadow-md focus-within:ring-4 focus-within:ring-emerald-500/10"
      :class="isHero ? 'shadow-stone-900/5' : 'shadow-stone-900/[0.06]'"
      aria-label="Message SecondLife AI"
      @submit.prevent="submit"
    >
      <!-- Attachment preview -->
      <div v-if="attachment.status !== 'empty'" class="px-2.5 pt-2.5 motion-safe:animate-fade">
        <div class="inline-flex max-w-full items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-1.5">
          <div class="relative size-14 shrink-0 overflow-hidden rounded-xl bg-stone-200">
            <img
              v-if="attachment.status === 'ready' && attachment.url"
              :src="attachment.url"
              :alt="readyVideo ? 'Frame from the video to send' : 'Photo to send'"
              class="size-full object-cover"
            />
            <div v-else class="grid size-full place-items-center text-stone-500">
              <Video v-if="readyVideo" class="size-5" aria-hidden="true" />
              <LoaderCircle v-else class="size-5 motion-safe:animate-spin" aria-hidden="true" />
            </div>
            <span
              v-if="readyVideo"
              class="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-stone-900/65 px-1 py-0.5 text-[10px] font-medium text-white tabular-nums"
            >
              <Play class="size-2.5 fill-current" aria-hidden="true" />
              {{ formatDuration(readyVideo.durationMs) }}
            </span>
          </div>
          <div class="min-w-0 text-xs leading-snug" role="status">
            <template v-if="attachment.status === 'ready'">
              <p class="truncate font-medium text-stone-700">{{ sampleLabel ? `Sample photo · ${sampleLabel}` : readyVideo ? 'Video attached' : 'Photo attached' }}</p>
              <p class="mt-0.5 flex items-center gap-1 text-stone-500">
                <ShieldCheck class="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                {{ sampleLabel ? 'Bundled demo photo' : readyVideo ? 'Location data removed' : 'Resized, location data removed' }}
              </p>
            </template>
            <p v-else class="font-medium text-stone-600">{{ processingVideo ? 'Preparing video…' : 'Preparing photo…' }}</p>
          </div>
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
            aria-label="Remove attachment"
            @click="removeAttachment()"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>
        <p v-if="readyVideo && attachment.status === 'ready' && !attachment.url" class="mt-1.5 px-1 text-xs text-stone-500">
          Your browser can’t preview this clip, so it will be sent without highlighted areas.
        </p>
        <p v-if="!supportsImages && attachment.status === 'ready'" class="mt-1.5 px-1 text-xs text-amber-800">
          This assistant can’t look at photos yet, so please describe the device too.
        </p>
      </div>

      <div class="flex" :class="isHero ? 'flex-wrap items-center gap-x-2 px-2 pb-2' : 'items-end gap-1 p-1.5'">
        <label :for="`${uid}-input`" class="sr-only">Message</label>
        <textarea
          :id="`${uid}-input`"
          ref="textarea"
          v-model="draft"
          rows="1"
          :maxlength="MAX_LENGTH"
          :placeholder="isHero ? 'Which old device gets a second life today?' : 'Reply or add details…'"
          enterkeyhint="send"
          autocomplete="off"
          :aria-describedby="[`${uid}-hint`, attachError ? `${uid}-error` : ''].filter(Boolean).join(' ')"
          class="block resize-none overflow-hidden bg-transparent text-base text-stone-900 placeholder:text-stone-400 focus:outline-none"
          :class="
            isHero
              ? 'order-first min-h-[4.5rem] basis-full px-3 pt-4 pb-1 sm:text-[17px]'
              : 'order-2 min-h-11 min-w-0 flex-1 px-1.5 py-2.5'
          "
          @keydown="onKeydown"
        />

        <div class="flex items-center gap-1" :class="isHero ? 'order-2 min-w-0 flex-1' : 'order-1'">
          <button
            type="button"
            class="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
            :class="isHero ? 'px-3' : 'w-11'"
            :disabled="sending || isProcessing"
            :aria-label="supportsVideo ? 'Attach a photo or video' : 'Attach a photo'"
            @click="fileInput?.click()"
          >
            <ImagePlus class="size-5" aria-hidden="true" />
            <span v-if="isHero" aria-hidden="true">{{ supportsVideo ? 'Add photo or video' : 'Add photo' }}</span>
          </button>
          <MicButton v-if="speechToText" :disabled="sending || isProcessing" />
          <LocationPicker :variant="variant" :disabled="sending" />
          <input
            ref="fileInput"
            type="file"
            :accept="acceptTypes"
            class="hidden"
            tabindex="-1"
            aria-hidden="true"
            @change="onFileChange"
          />
          <p :id="`${uid}-hint`" class="truncate text-xs text-stone-400" :class="isHero ? 'hidden md:block' : 'sr-only'">
            <kbd class="font-sans font-medium text-stone-500">Enter</kbd> to send ·
            <kbd class="font-sans font-medium text-stone-500">Shift + Enter</kbd> for a new line
          </p>
        </div>

        <div class="order-3 flex shrink-0 items-center gap-2">
          <span v-if="showCount" class="text-xs text-stone-400 tabular-nums" aria-live="polite">
            {{ draft.length }}/{{ MAX_LENGTH }}
          </span>
          <button
            type="submit"
            class="grid size-11 place-items-center rounded-full bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
            :disabled="!canSend"
            :aria-label="sending ? 'Sending…' : 'Send message'"
          >
            <LoaderCircle v-if="sending" class="size-5 motion-safe:animate-spin" aria-hidden="true" />
            <ArrowUp v-else class="size-5" :stroke-width="2.4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>

    <p
      v-if="attachError"
      :id="`${uid}-error`"
      role="alert"
      class="mt-2 flex items-start gap-2 px-3 text-sm text-red-700 motion-safe:animate-fade"
    >
      <span class="flex-1">{{ attachError }}</span>
      <button
        type="button"
        class="-my-1 shrink-0 rounded px-1 py-1 text-xs font-medium underline underline-offset-2 hover:text-red-900"
        @click="clearError()"
      >
        Dismiss
      </button>
    </p>
  </div>
</template>
