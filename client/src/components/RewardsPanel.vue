<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Gift, LoaderCircle, X } from '@lucide/vue';
import { HANDOVER_POINTS, type Reward } from '../../../shared/schemas';
import { INDIAN_STATES } from '../../../shared/india-states';
import { useLocation } from '../composables/useLocation';
import { useWallet } from '../composables/useWallet';
import { ApiError } from '../lib/api';
import { getRewards, redeemReward } from '../lib/rewards-api';
import DemoChip from './DemoChip.vue';

// Balances, ways to earn, rewards for the user's state, and recent history, in a native dialog
// (bottom sheet on phones, side panel on larger screens): it handles focus and Escape.
const uid = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const { location } = useLocation();
const wallet = useWallet();
const { points, demoPoints, history } = wallet;

const rewards = ref<Reward[]>([]);
const loading = ref(false);
const failed = ref(false);
const redeeming = ref<string | null>(null);
const error = ref<string | null>(null);
const redeemed = ref<{ code: string; title: string; partner: string; demo: boolean } | null>(null);
let ctl: AbortController | null = null;

const stateName = computed(() => (location.value ? INDIAN_STATES[location.value.state] : null));

async function loadRewards() {
  ctl?.abort();
  const c = (ctl = new AbortController());
  loading.value = true;
  failed.value = false;
  try {
    const list = await getRewards(location.value?.state ?? null, c.signal);
    if (!c.signal.aborted) rewards.value = list;
  } catch {
    if (!c.signal.aborted) failed.value = true;
  } finally {
    if (ctl === c) loading.value = false;
  }
}

function show() {
  error.value = null;
  redeemed.value = null;
  if (!dialog.value?.open) dialog.value?.showModal();
  void loadRewards();
}
const close = () => dialog.value?.close();
defineExpose({ show });

function onDialogClick(e: MouseEvent) {
  if (e.target === dialog.value) close();
}

const balance = (r: Reward) => (r.demo ? demoPoints.value : points.value);
const shortBy = (r: Reward) => Math.max(0, r.points - balance(r));

async function redeem(r: Reward) {
  if (redeeming.value || shortBy(r)) return;
  redeeming.value = r.id;
  error.value = null;
  try {
    const res = await redeemReward(r.id);
    wallet.apply(res.wallet);
    redeemed.value = { code: res.code, title: res.reward.title, partner: res.reward.partnerName, demo: res.reward.demo };
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Couldn’t redeem that. Please try again.';
    void wallet.refresh();
  } finally {
    redeeming.value = null;
  }
}

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const earn = [
  ['Donate a device', HANDOVER_POINTS.donate],
  ['Recycle e-waste', HANDOVER_POINTS.recycle],
  ['Get a repair', HANDOVER_POINTS.repair],
] as const;
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="mt-auto mb-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-stone-200 bg-white text-stone-800 shadow-xl backdrop:bg-stone-900/40 backdrop:backdrop-blur-[2px] open:motion-safe:animate-rise sm:m-0 sm:mr-0 sm:ml-auto sm:h-dvh sm:max-h-dvh sm:max-w-md sm:rounded-l-3xl sm:rounded-r-none"
      :aria-labelledby="`${uid}-title`"
      @click="onDialogClick"
    >
      <div class="pb-safe space-y-5 px-5 pt-5 pb-6">
        <div class="flex items-start gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Gift class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 :id="`${uid}-title`" class="text-lg font-semibold text-stone-900">Your points</h2>
            <p class="text-sm text-stone-500">Earned when a partner confirms your handover.</p>
          </div>
          <button
            type="button"
            class="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-label="Close"
            autofocus
            @click="close"
          >
            <X class="size-5" aria-hidden="true" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3">
            <p class="text-xs font-medium text-emerald-900">Points</p>
            <p class="text-2xl font-semibold text-stone-900">{{ points }}</p>
          </div>
          <div class="rounded-2xl border border-amber-200 bg-amber-50/60 px-3.5 py-3">
            <p class="flex items-center gap-1.5 text-xs font-medium text-amber-900">Demo points <DemoChip /></p>
            <p class="text-2xl font-semibold text-stone-900">{{ demoPoints }}</p>
          </div>
        </div>
        <p class="-mt-3 text-xs text-stone-500">Demo points: from demo partners, only for demo rewards.</p>

        <section aria-labelledby="earn-h">
          <h3 id="earn-h" class="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">How to earn</h3>
          <ul class="divide-y divide-stone-100 rounded-2xl border border-stone-200 text-sm">
            <li v-for="[label, pts] in earn" :key="label" class="flex justify-between px-3.5 py-2.5">
              <span>{{ label }}</span><span class="font-medium text-emerald-800">{{ pts }} points</span>
            </li>
          </ul>
          <p class="mt-2 text-xs text-stone-500">Points are added when a partner confirms your handover code.</p>
        </section>

        <section aria-labelledby="rewards-h">
          <h3 id="rewards-h" class="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Rewards<template v-if="stateName"> in {{ stateName }}</template>
          </h3>
          <div v-if="redeemed" class="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 motion-safe:animate-pop" role="status">
            <p class="text-sm font-semibold text-emerald-900">{{ redeemed.title }}</p>
            <p class="mt-1.5 font-mono text-2xl font-semibold tracking-widest text-stone-900 select-all">{{ redeemed.code }}</p>
            <p class="mt-1 text-sm text-stone-700">Show this code at {{ redeemed.partner }}.</p>
          </div>
          <p v-if="error" class="mb-2 text-sm text-red-700" role="alert">{{ error }}</p>
          <p v-if="loading && !rewards.length" class="flex items-center gap-2 text-sm text-stone-500" role="status">
            <LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" /> Loading rewards…
          </p>
          <p v-else-if="failed" class="text-sm text-stone-600">Couldn’t load rewards just now.</p>
          <p v-else-if="!rewards.length" class="text-sm text-stone-600">No rewards available yet.</p>
          <ul v-else class="space-y-2">
            <li v-for="r in rewards" :key="r.id" class="rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-xs">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-[15px] leading-snug font-medium text-stone-900">{{ r.title }}</span>
                <DemoChip v-if="r.demo" />
              </div>
              <p class="mt-0.5 text-sm text-stone-600">{{ r.description }}</p>
              <p class="mt-0.5 text-xs text-stone-500">{{ r.partnerName }}</p>
              <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-stone-900">{{ r.points }} {{ r.demo ? 'demo ' : '' }}points</span>
                <div class="flex items-center gap-2">
                  <span v-if="shortBy(r)" class="text-xs text-stone-500">Need {{ shortBy(r) }} more</span>
                  <button
                    type="button"
                    :disabled="!!shortBy(r) || !!redeeming"
                    class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] disabled:bg-stone-200 disabled:text-stone-500"
                    @click="redeem(r)"
                  >
                    <LoaderCircle v-if="redeeming === r.id" class="size-4 motion-safe:animate-spin" aria-hidden="true" />
                    Redeem<span class="sr-only">: {{ r.title }}</span>
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="history.length" aria-labelledby="hist-h">
          <h3 id="hist-h" class="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Recent</h3>
          <ul class="divide-y divide-stone-100 rounded-2xl border border-stone-200 text-sm">
            <li v-for="(h, i) in history.slice(0, 10)" :key="i" class="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <span class="min-w-0">
                <span class="block text-stone-800">{{ h.label }}</span>
                <span class="text-xs text-stone-500">{{ date(h.at) }}<template v-if="h.demo"> · demo points</template></span>
              </span>
              <span class="shrink-0 font-medium" :class="h.points >= 0 ? 'text-emerald-800' : 'text-stone-600'">
                {{ h.points > 0 ? '+' : '' }}{{ h.points }}
              </span>
            </li>
          </ul>
        </section>

        <p class="text-xs leading-relaxed text-stone-500">Your points live on this device; clearing browser data removes them.</p>
      </div>
    </dialog>
  </Teleport>
</template>
