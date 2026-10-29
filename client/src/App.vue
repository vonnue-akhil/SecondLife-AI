<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ImagePlus } from '@lucide/vue';
import AppHeader from './components/AppHeader.vue';
import ChatComposer from './components/ChatComposer.vue';
import LandingHero from './components/LandingHero.vue';
import MessageList from './components/MessageList.vue';
import { useComposer } from './composables/useComposer';
import { useConversation } from './composables/useConversation';
import { firstImageFile } from './lib/image';

const conversation = useConversation();
const { hasConversation, sending, modeBadge } = conversation;
const composerState = useComposer();
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);

const busy = computed(() => sending.value || composerState.isProcessing.value);

/** Suggested prompts and quick replies send straight away, with any photo already attached. */
function sendText(text: string) {
  if (busy.value) return;
  const image = composerState.takeAttachment();
  conversation.send(text, image);
}

function startOver() {
  conversation.reset();
  composerState.clear();
  window.scrollTo({ top: 0 });
}

// Focus the docked composer once the landing view hands over to the conversation.
watch(hasConversation, (now, before) => {
  if (now && !before && window.matchMedia('(pointer: fine)').matches) nextTick(() => composer.value?.focus());
});

// ---------------------------------------------------------------------------
// Drag-and-drop and paste anywhere on the page attach a photo.
// ---------------------------------------------------------------------------
const dragDepth = ref(0);
const dragging = computed(() => dragDepth.value > 0);

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}
function onDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth.value++;
}
function onDragOver(e: DragEvent) {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}
function onDragLeave(e: DragEvent) {
  if (hasFiles(e)) dragDepth.value = Math.max(0, dragDepth.value - 1);
}
function onDrop(e: DragEvent) {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth.value = 0;
  if (sending.value) return;
  const file = firstImageFile(e.dataTransfer?.files) ?? e.dataTransfer?.files[0];
  if (file) void composerState.attachFile(file); // non-images get a clear message
}
function onPaste(e: ClipboardEvent) {
  if (sending.value) return;
  const file = firstImageFile(e.clipboardData?.items);
  if (!file) return; // plain text pastes behave normally
  e.preventDefault();
  void composerState.attachFile(file);
}

onMounted(() => {
  void conversation.loadHealth();
  window.addEventListener('paste', onPaste);
});
onBeforeUnmount(() => window.removeEventListener('paste', onPaste));
</script>

<template>
  <div class="flex min-h-dvh flex-col" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <a
      href="#composer"
      class="sr-only z-50 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Skip to message box
    </a>

    <AppHeader :badge="modeBadge" :show-new-conversation="hasConversation" @new-conversation="startOver" />

    <main class="flex flex-1 flex-col">
      <LandingHero v-if="!hasConversation" :busy="busy" @prompt="sendText" />

      <template v-else>
        <div class="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-6 sm:pt-8">
          <h1 class="sr-only">Conversation with SecondLife AI</h1>
          <MessageList @reply="sendText" />
        </div>

        <div id="composer" class="pb-safe sticky bottom-0 z-20 bg-gradient-to-t from-stone-50 from-75% to-stone-50/0 pt-4">
          <div class="mx-auto w-full max-w-3xl px-4">
            <ChatComposer ref="composer" variant="docked" />
            <p class="mt-1.5 hidden text-center text-[11px] text-stone-400 sm:block">
              General guidance, not a professional diagnosis · Photos are never stored
            </p>
          </div>
        </div>
      </template>
    </main>

    <div
      v-if="dragging"
      class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-emerald-900/10 p-6 backdrop-blur-[2px] motion-safe:animate-fade"
      aria-hidden="true"
    >
      <div class="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-emerald-500 bg-white/95 px-10 py-8 text-center shadow-xl">
        <span class="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <ImagePlus class="size-6" aria-hidden="true" />
        </span>
        <p class="font-semibold text-stone-900">Drop your photo to attach it</p>
        <p class="text-sm text-stone-500">JPEG, PNG, WebP or HEIC</p>
      </div>
    </div>
  </div>
</template>
