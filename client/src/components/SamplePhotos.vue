<script setup lang="ts">
import { computed, ref } from 'vue';
import { CircleCheck, LoaderCircle } from '@lucide/vue';
import { useComposer } from '../composables/useComposer';
import { SAMPLE_PHOTOS, type SamplePhoto } from '../lib/samples';

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ picked: [] }>();

const { attachment, attachSample } = useComposer();

// Hide any sample whose image fails to load, and the whole row if none are available.
const broken = ref(new Set<string>());
const visible = computed(() => SAMPLE_PHOTOS.filter((s) => !broken.value.has(s.id)));

function markBroken(id: string) {
  broken.value = new Set(broken.value).add(id);
}

const activeId = computed(() => (attachment.value.status === 'empty' ? null : attachment.value.sampleId));
const loadingId = computed(() => (attachment.value.status === 'processing' ? attachment.value.sampleId : null));

async function pick(sample: SamplePhoto) {
  if (await attachSample(sample)) emit('picked');
}
</script>

<template>
  <section v-if="visible.length" aria-labelledby="samples-title">
    <h2 id="samples-title" class="text-center text-xs font-semibold tracking-wide text-stone-500 uppercase">
      No device handy? Try a sample photo
    </h2>
    <ul class="mx-auto mt-3 grid max-w-md grid-cols-3 gap-2.5 sm:gap-3">
      <li v-for="sample in visible" :key="sample.id">
        <button
          type="button"
          class="group flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-xs transition hover:-translate-y-px hover:shadow-sm active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 motion-reduce:hover:translate-y-0"
          :class="activeId === sample.id ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-stone-200 hover:border-emerald-300'"
          :aria-pressed="activeId === sample.id"
          :disabled="disabled"
          @click="pick(sample)"
        >
          <span class="relative block aspect-[4/3] w-full overflow-hidden bg-stone-100">
            <img
              :src="sample.src"
              alt=""
              loading="lazy"
              decoding="async"
              class="size-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
              @error="markBroken(sample.id)"
            />
            <span
              v-if="loadingId === sample.id || activeId === sample.id"
              class="absolute inset-0 grid place-items-center bg-stone-900/30 text-white motion-safe:animate-fade"
            >
              <LoaderCircle v-if="loadingId === sample.id" class="size-5 motion-safe:animate-spin" aria-hidden="true" />
              <CircleCheck v-else class="size-6 drop-shadow" aria-hidden="true" />
            </span>
          </span>
          <span class="block px-2.5 py-2 text-[13px] leading-tight font-medium text-stone-700 group-hover:text-stone-900">
            {{ sample.label }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
