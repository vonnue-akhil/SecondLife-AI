<script setup lang="ts">
import { SquarePen } from '@lucide/vue';
import type { ModeBadgeState } from '../lib/presentation';
import BrandMark from './BrandMark.vue';
import ModeBadge from './ModeBadge.vue';

defineProps<{ badge: ModeBadgeState; showNewConversation: boolean }>();
defineEmits<{ newConversation: [] }>();
</script>

<template>
  <header class="pt-safe sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50">
    <div class="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
      <div class="flex shrink-0 items-center gap-2.5">
        <BrandMark />
        <span class="text-[15px] font-semibold tracking-tight whitespace-nowrap text-stone-900">
          SecondLife <span class="text-emerald-700">AI</span>
        </span>
      </div>

      <div class="flex min-w-0 items-center justify-end gap-1.5">
        <ModeBadge :state="badge" class="max-w-[11rem] sm:max-w-[18rem]" />
        <button
          v-if="showNewConversation"
          type="button"
          class="-mr-1.5 inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-stone-700 transition hover:bg-stone-200/70 active:scale-[0.98] sm:mr-0 sm:h-9 sm:w-auto sm:border sm:border-stone-200 sm:bg-white sm:px-3 sm:shadow-xs sm:hover:border-stone-300 sm:hover:bg-stone-100"
          aria-label="New conversation"
          title="New conversation"
          @click="$emit('newConversation')"
        >
          <SquarePen class="size-[18px] sm:size-4" aria-hidden="true" />
          <span class="hidden sm:inline">New conversation</span>
        </button>
      </div>
    </div>
  </header>
</template>
