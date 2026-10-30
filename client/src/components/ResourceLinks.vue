<script setup lang="ts">
import { BadgeCheck, ExternalLink, Globe } from '@lucide/vue';
import type { Resource } from '../../../shared/schemas';
import { hostname } from '../lib/presentation';

defineProps<{ resources: Resource[] }>();
</script>

<template>
  <ul class="space-y-2">
    <li v-for="r in resources" :key="r.id">
      <a
        :href="r.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-xs transition hover:border-emerald-300 hover:shadow-sm"
      >
        <span class="flex items-start justify-between gap-3">
          <span class="min-w-0 text-[15px] leading-snug font-medium text-stone-900 group-hover:text-emerald-800">
            {{ r.name }}
          </span>
          <ExternalLink class="mt-0.5 size-4 shrink-0 text-stone-400 transition group-hover:text-emerald-700" aria-hidden="true" />
        </span>
        <span class="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-600">{{ r.description }}</span>
        <span class="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <template v-if="r.source === 'web'">
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
              <Globe class="size-3 shrink-0" aria-hidden="true" />
              Found on the web — check before visiting
            </span>
            <span class="min-w-0 truncate text-stone-500">Source: {{ hostname(r.citationUrl ?? r.url) }}</span>
          </template>
          <template v-else>
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset">
              <BadgeCheck class="size-3 shrink-0" aria-hidden="true" />
              Curated
            </span>
            <span class="min-w-0 truncate text-stone-500">{{ hostname(r.url) }}</span>
          </template>
        </span>
        <span class="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  </ul>
</template>
