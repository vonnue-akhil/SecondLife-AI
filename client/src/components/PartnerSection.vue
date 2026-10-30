<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Check, Copy, HandHeart, LoaderCircle, MapPin, MessageCircle, Phone, RefreshCw, Sparkles } from '@lucide/vue';
import { HANDOVER_POINTS, type Handover, type Partner, type PartnerService } from '../../../shared/schemas';
import { INDIAN_STATES } from '../../../shared/india-states';
import { useConversation } from '../composables/useConversation';
import { useLocation } from '../composables/useLocation';
import { useWallet } from '../composables/useWallet';
import { ApiError } from '../lib/api';
import { createHandover, getHandover, getPartners } from '../lib/rewards-api';
import { loadHandover, removeHandover, saveHandover } from '../lib/handover-store';
import DemoChip from './DemoChip.vue';

// Repair shops and drop-off points for a card, plus the handover code that earns points.
const props = defineProps<{ action: PartnerService }>();

const POLL_MS = 15_000;
const POLL_MAX_MS = 15 * 60 * 1000;

const { location } = useLocation();
const { conversationId } = useConversation();
const wallet = useWallet();

const partners = ref<Partner[]>([]);
const loading = ref(false);
const failed = ref(false);
const selectedId = ref<string | null>(null);
const handover = ref<Handover | null>(null);
const creating = ref(false);
const checking = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);
const justConfirmed = ref(false);

const points = computed(() => HANDOVER_POINTS[props.action]);
const area = computed(() => {
  const l = location.value;
  if (!l) return null;
  return l.place || l.district || INDIAN_STATES[l.state];
});
const heading = computed(() => (props.action === 'repair' ? `Repair shops near ${area.value}` : `Hand it over near ${area.value}`));
const selected = computed(() => partners.value.find((p) => p.id === selectedId.value) ?? null);
const open = computed(() => handover.value?.status === 'open');

let listCtl: AbortController | null = null;
const lifeCtl = new AbortController(); // aborted on unmount: covers every other request
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollStart = 0;

const whatsappHref = (p: Partner) => `https://wa.me/${(p.phone ?? '').replace(/\D/g, '')}`;
const telHref = (p: Partner) => `tel:${(p.phone ?? '').replace(/[^\d+]/g, '')}`;
const where = (p: Partner) => [p.place, p.district && `${p.district} district`].filter(Boolean).join(', ');

async function loadPartners() {
  listCtl?.abort();
  const l = location.value;
  if (!l) {
    partners.value = [];
    return;
  }
  const ctl = (listCtl = new AbortController());
  loading.value = true;
  failed.value = false;
  try {
    const list = await getPartners({ state: l.state, district: l.district, service: props.action }, ctl.signal);
    if (ctl.signal.aborted) return;
    partners.value = list;
    if (!list.some((p) => p.id === selectedId.value)) selectedId.value = list[0]?.id ?? null;
  } catch {
    if (ctl.signal.aborted) return;
    partners.value = [];
    failed.value = true;
  } finally {
    if (listCtl === ctl) loading.value = false;
  }
}

watch(() => [location.value?.state, location.value?.district, props.action] as const, loadPartners, { immediate: true });

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function startPolling() {
  stopPolling();
  pollStart = Date.now();
  pollTimer = setInterval(() => {
    if (Date.now() - pollStart > POLL_MAX_MS) return stopPolling();
    void check(true);
  }, POLL_MS);
}

function apply(h: Handover) {
  handover.value = h;
  if (h.status === 'open') return;
  stopPolling();
  removeHandover(conversationId.value, props.action);
  if (h.status === 'confirmed') {
    justConfirmed.value = true;
    void wallet.refresh();
  }
}

async function check(quiet = false) {
  const h = handover.value;
  if (!h || h.status !== 'open' || checking.value) return;
  if (!quiet) checking.value = true;
  try {
    apply(await getHandover(h.code, lifeCtl.signal));
    error.value = null;
  } catch (err) {
    if (lifeCtl.signal.aborted) return;
    if (!quiet) error.value = err instanceof ApiError ? err.message : 'Couldn’t check just now.';
  } finally {
    checking.value = false;
  }
}

async function getCode() {
  if (!selected.value || creating.value) return;
  creating.value = true;
  error.value = null;
  try {
    const h = await createHandover(
      { action: props.action, partnerId: selected.value.id, conversationId: conversationId.value },
      lifeCtl.signal,
    );
    if (lifeCtl.signal.aborted) return;
    justConfirmed.value = false;
    handover.value = h;
    saveHandover(conversationId.value, props.action, h);
    if (h.status === 'open') startPolling();
  } catch (err) {
    if (lifeCtl.signal.aborted) return;
    error.value = err instanceof ApiError ? err.message : 'Couldn’t get a code. Please try again.';
  } finally {
    creating.value = false;
  }
}

async function copy() {
  if (!handover.value) return;
  try {
    await navigator.clipboard.writeText(handover.value.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    error.value = 'Couldn’t copy. Please note the code down.';
  }
}

// A reload of the same conversation still shows the code.
const saved = loadHandover(conversationId.value, props.action);
if (saved) {
  handover.value = saved;
  void getHandover(saved.code, lifeCtl.signal)
    .then((h) => {
      apply(h);
      if (h.status === 'open') startPolling();
    })
    .catch(() => {
      if (!lifeCtl.signal.aborted && handover.value?.status === 'open') startPolling();
    });
}

onBeforeUnmount(() => {
  stopPolling();
  listCtl?.abort();
  lifeCtl.abort();
});

const ring =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';
const btn =
  `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition active:scale-[0.98] ${ring}`;
</script>

<template>
  <section class="space-y-3" :aria-label="area ? heading : 'Partners near you'">
    <template v-if="!location">
      <p class="flex items-start gap-2 rounded-2xl bg-stone-50 px-3.5 py-3 text-sm leading-relaxed text-stone-600">
        <MapPin class="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden="true" />
        Share your area (the location button under the message box) to see repair shops and drop-off points near you.
      </p>
    </template>

    <template v-else>
      <h5 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">{{ heading }}</h5>

      <p v-if="loading" class="flex items-center gap-2 text-sm text-stone-500" role="status">
        <LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" /> Looking nearby…
      </p>
      <p v-else-if="failed" class="text-sm text-stone-600">
        Couldn’t load partners just now.
        <button type="button" class="font-medium text-emerald-700 underline underline-offset-2" @click="loadPartners">Try again</button>
      </p>
      <p v-else-if="!partners.length" class="rounded-2xl bg-stone-50 px-3.5 py-3 text-sm text-stone-600">No partners near you yet.</p>

      <ul v-else class="space-y-2">
        <li
          v-for="p in partners"
          :key="p.id"
          class="rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-xs"
        >
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-[15px] leading-snug font-medium text-stone-900">{{ p.name }}</span>
            <DemoChip v-if="p.demo" />
          </div>
          <p v-if="p.devices.length" class="mt-1 text-sm text-stone-600">Handles: {{ p.devices.join(', ') }}</p>
          <p v-if="where(p)" class="mt-0.5 flex items-center gap-1 text-sm text-stone-500">
            <MapPin class="size-3.5 shrink-0" aria-hidden="true" />{{ where(p) }}
          </p>
          <p v-if="p.demo" class="mt-2 text-xs text-stone-500">Demo listing · no contact details</p>
          <template v-else>
            <div v-if="p.phone" class="mt-2.5 flex flex-wrap gap-2">
              <a :href="telHref(p)" :class="[btn, 'border border-stone-200 bg-white text-stone-800 hover:border-emerald-300']">
                <Phone class="size-4" aria-hidden="true" /> Call {{ p.phone }}
              </a>
              <a
                v-if="p.whatsapp"
                :href="whatsappHref(p)"
                target="_blank"
                rel="noopener noreferrer"
                :class="[btn, 'border border-stone-200 bg-white text-stone-800 hover:border-emerald-300']"
              >
                <MessageCircle class="size-4" aria-hidden="true" /> WhatsApp
                <span class="sr-only">(opens in a new tab)</span>
              </a>
            </div>
            <p class="mt-2 text-xs text-stone-500">Community-listed · not checked by SecondLife</p>
          </template>
        </li>
      </ul>

      <!-- Earn points -->
      <div v-if="partners.length" class="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3.5">
        <template v-if="!handover">
          <p class="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
            <HandHeart class="size-4" aria-hidden="true" /> Earn {{ points }} points
          </p>
          <p class="mt-0.5 text-sm text-stone-600">Pick where you’ll go, get a code, and show it when you hand the device over.</p>
          <fieldset v-if="partners.length > 1" class="mt-2.5 space-y-1.5">
            <legend class="sr-only">Where will you go?</legend>
            <label
              v-for="p in partners"
              :key="p.id"
              class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3 text-sm text-stone-800 ring-1 ring-stone-200 ring-inset has-checked:ring-2 has-checked:ring-emerald-600 has-focus-visible:outline-2 has-focus-visible:outline-emerald-600"
            >
              <input v-model="selectedId" type="radio" :value="p.id" class="size-4 accent-emerald-600" />
              <span class="min-w-0 flex-1 truncate">{{ p.name }}</span>
              <DemoChip v-if="p.demo" />
            </label>
          </fieldset>
          <p v-if="selected?.demo" class="mt-2 text-xs text-amber-800">This is a demo partner, so you’d earn demo points.</p>
          <button
            type="button"
            :disabled="!selected || creating"
            :class="[btn, 'mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto']"
            @click="getCode"
          >
            <LoaderCircle v-if="creating" class="size-4 motion-safe:animate-spin" aria-hidden="true" />
            Get my handover code
          </button>
        </template>

        <template v-else-if="justConfirmed">
          <div class="flex items-center gap-3 motion-safe:animate-pop" role="status">
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
              <Sparkles class="size-5" aria-hidden="true" />
            </span>
            <div>
              <p class="text-base font-semibold text-emerald-900">+{{ handover.points }} {{ handover.demo ? 'demo ' : '' }}points added</p>
              <p class="text-sm text-stone-600">{{ handover.partnerName }} confirmed your handover. Thank you!</p>
            </div>
          </div>
        </template>

        <template v-else-if="open">
          <p class="text-xs font-semibold tracking-wide text-emerald-900 uppercase">Your handover code</p>
          <div class="mt-1.5 flex items-center gap-2">
            <span class="rounded-xl bg-white px-3 py-2 font-mono text-2xl font-semibold tracking-widest text-stone-900 ring-1 ring-emerald-200 ring-inset select-all">
              {{ handover.code }}
            </span>
            <button
              type="button"
              :class="[btn, 'size-11 shrink-0 border border-stone-200 bg-white px-0 text-stone-700 hover:border-emerald-300']"
              aria-label="Copy code"
              @click="copy"
            >
              <Check v-if="copied" class="size-4 text-emerald-700" aria-hidden="true" />
              <Copy v-else class="size-4" aria-hidden="true" />
            </button>
          </div>
          <p class="mt-2.5 text-sm leading-relaxed text-stone-700">
            Show this code at {{ handover.partnerName }} when you hand over your device. Your points are added once they confirm. Valid for 1 year.
          </p>
          <p v-if="handover.demo" class="mt-1 text-xs text-amber-800">Demo partner: you’ll earn demo points.</p>
          <div class="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              :disabled="checking"
              :class="[btn, 'border border-stone-200 bg-white text-stone-800 hover:border-emerald-300 disabled:opacity-60']"
              @click="check()"
            >
              <RefreshCw class="size-4" :class="checking ? 'motion-safe:animate-spin' : ''" aria-hidden="true" /> Check now
            </button>
            <span class="text-xs text-stone-500">Waiting for {{ handover.partnerName }} to confirm</span>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-stone-700">That code ran out. You can get a new one any time.</p>
          <button type="button" :class="[btn, 'mt-2 border border-stone-200 bg-white text-stone-800']" @click="handover = null">
            Get a new code
          </button>
        </template>

        <p v-if="error" class="mt-2 text-sm text-red-700" role="alert">{{ error }}</p>
      </div>
    </template>
  </section>
</template>
