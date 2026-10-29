<script setup lang="ts">
defineProps<{ replies: string[]; disabled: boolean }>();
defineEmits<{ select: [text: string] }>();
</script>

<template>
  <div class="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
    <button
      v-for="reply in replies"
      :key="reply"
      type="button"
      class="min-h-11 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-xs transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      :disabled="disabled"
      @click="$emit('select', reply)"
    >
      {{ reply }}
    </button>
  </div>
</template>
