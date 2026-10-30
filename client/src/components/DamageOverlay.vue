<script setup lang="ts">
import { computed, ref } from 'vue';
import { Eye, EyeOff, ScanSearch } from '@lucide/vue';
import type { DamageRegion, ProviderInfo } from '../../../shared/schemas';
import type { Photo } from '../composables/useConversation';

const props = defineProps<{ photo: Photo; regions: DamageRegion[]; segmentation: ProviderInfo; fromVideo?: boolean }>();

// Translucent fill + crisp stroke per concept; labels use a deeper shade for white text.
const PALETTE = [
  { fill: '#f43f5e', label: '#be123c' }, // rose
  { fill: '#f59e0b', label: '#b45309' }, // amber
  { fill: '#0ea5e9', label: '#0369a1' }, // sky
  { fill: '#a855f7', label: '#7e22ce' }, // purple
  { fill: '#22c55e', label: '#15803d' }, // green
];

const visible = ref(true);

// Polygons are pixel coordinates in the uploaded bytes, which is exactly what <img> shows.
// Prefer the decoded natural size once loaded; the stored size reserves space before that.
const natural = ref({ w: props.photo.width, h: props.photo.height });
function onLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.naturalWidth && img.naturalHeight) natural.value = { w: img.naturalWidth, h: img.naturalHeight };
}
const size = computed(() => (natural.value.w > 0 && natural.value.h > 0 ? natural.value : { w: 4, h: 3 }));

const concepts = computed(() => [...new Set(props.regions.map((r) => r.concept))]);
function colourOf(concept: string) {
  return PALETTE[concepts.value.indexOf(concept) % PALETTE.length]!;
}

interface Shape {
  key: number;
  concept: string;
  colour: { fill: string; label: string };
  path: string; // every polygon of the region as one path, filled evenodd so holes stay holes
  labelStyle: Record<string, string>;
}

/** Puts the label just above the region (or below / inside the top when there's no room), never off the image. */
function labelStyleFor(minX: number, minY: number, maxX: number, maxY: number): Record<string, string> {
  const { w, h } = size.value;
  const left = (minX / w) * 100;
  const right = 100 - (maxX / w) * 100;
  const top = (minY / h) * 100;
  const bottom = 100 - (maxY / h) * 100;
  const style: Record<string, string> = {};

  if ((minX + maxX) / 2 / w <= 0.5) {
    style.left = `max(6px, ${left.toFixed(2)}%)`;
    style.maxWidth = `calc(${(100 - left).toFixed(2)}% - 12px)`;
  } else {
    style.right = `max(6px, ${right.toFixed(2)}%)`;
    style.maxWidth = `calc(${(100 - right).toFixed(2)}% - 12px)`;
  }

  if (top >= 12) style.bottom = `calc(${(100 - top).toFixed(2)}% + 4px)`;
  else if (bottom >= 12) style.top = `calc(${(100 - bottom).toFixed(2)}% + 4px)`;
  else style.top = `calc(${top.toFixed(2)}% + 8px)`;
  return style;
}

function boundsOf(polygons: DamageRegion['polygons']): [number, number, number, number] {
  const points = polygons.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const shapes = computed<Shape[]>(() =>
  props.regions.flatMap((region, key) => {
    const polygons = region.polygons.filter((p) => p.length >= 3);
    if (!polygons.length) return [];
    const [minX, minY, maxX, maxY] = boundsOf(polygons);
    return [
      {
        key,
        concept: region.concept,
        colour: colourOf(region.concept),
        path: polygons.map((p) => `M${p.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join(''),
        labelStyle: labelStyleFor(minX, minY, maxX, maxY),
      },
    ];
  }),
);

// One label per concept, on its highest-scoring region, keeps a phone-sized photo readable; the legend covers the rest.
const labelledShapes = computed(() => {
  const best = new Map<string, Shape>();
  for (const shape of shapes.value) {
    const current = best.get(shape.concept);
    if (!current || props.regions[shape.key]!.score > props.regions[current.key]!.score) best.set(shape.concept, shape);
  }
  return [...best.values()];
});
function countOf(concept: string) {
  return props.regions.filter((r) => r.concept === concept).length;
}

const caption = computed(() => {
  const base = props.segmentation.isMock ? 'Demo highlights, pre-traced for this sample' : `Highlighted by ${props.segmentation.name}`;
  return props.fromVideo ? `Frame from your video · ${base}` : base;
});
const altText = computed(() => `${props.fromVideo ? 'A frame from your video' : 'Your photo'}, with possible damage highlighted: ${concepts.value.join(', ')}.`);
</script>

<template>
  <figure class="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm shadow-stone-900/5">
    <div class="flex items-center justify-between gap-2 py-1 pr-1.5 pl-4">
      <p class="flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-800">
        <ScanSearch class="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <span class="truncate">What I spotted</span>
      </p>
      <button
        type="button"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
        @click="visible = !visible"
      >
        <component :is="visible ? EyeOff : Eye" class="size-4" aria-hidden="true" />
        {{ visible ? 'Hide highlights' : 'Show highlights' }}
      </button>
    </div>

    <div class="flex justify-center border-y border-stone-200/70 bg-stone-100 [--max-h:20rem] sm:[--max-h:28rem]">
      <div
        class="relative"
        :style="{
          aspectRatio: `${size.w} / ${size.h}`,
          width: `min(100%, calc(var(--max-h) * ${(size.w / size.h).toFixed(5)}))`,
        }"
      >
        <img :src="photo.url" :alt="altText" class="absolute inset-0 size-full object-contain" @load="onLoad" />
        <svg
          class="absolute inset-0 size-full transition-opacity duration-300 motion-reduce:transition-none"
          :class="visible ? 'opacity-100' : 'opacity-0'"
          :viewBox="`0 0 ${size.w} ${size.h}`"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <g v-for="shape in shapes" :key="shape.key">
            <!-- White halo keeps the outline legible on dark and light photos alike. -->
            <path
              :d="shape.path"
              fill="none"
              stroke="#ffffff"
              stroke-opacity="0.85"
              stroke-width="4"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
            <path
              :d="shape.path"
              :fill="shape.colour.fill"
              fill-opacity="0.38"
              fill-rule="evenodd"
              :stroke="shape.colour.fill"
              stroke-width="2"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </svg>
        <span
          v-for="shape in labelledShapes"
          :key="`label-${shape.key}`"
          class="pointer-events-none absolute truncate rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap text-white shadow-md ring-1 ring-white/50 transition-opacity duration-300 motion-reduce:transition-none"
          :class="visible ? 'opacity-100' : 'opacity-0'"
          :style="{ ...shape.labelStyle, backgroundColor: shape.colour.label }"
          aria-hidden="true"
        >
          {{ shape.concept }}
        </span>
      </div>
    </div>

    <figcaption class="px-4 pt-2.5 pb-3">
      <ul class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-stone-700" aria-label="Highlighted areas">
        <li v-for="concept in concepts" :key="concept" class="inline-flex items-center gap-1.5">
          <span
            class="size-2.5 shrink-0 rounded-sm ring-1 ring-black/10"
            :style="{ backgroundColor: colourOf(concept).fill }"
            aria-hidden="true"
          />
          {{ concept }}
          <span v-if="countOf(concept) > 1" class="font-normal text-stone-500">· {{ countOf(concept) }} areas</span>
        </li>
      </ul>
      <p class="mt-1 text-xs text-stone-500">{{ caption }} · approximate, not a diagnosis</p>
    </figcaption>
  </figure>
</template>
