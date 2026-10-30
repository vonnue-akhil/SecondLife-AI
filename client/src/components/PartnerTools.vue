<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue';
import { FlaskConical, LogOut } from '@lucide/vue';
import { INDIAN_STATES, isStateCode } from '../../../shared/india-states';
import type { Partner } from '../../../shared/schemas';
import { ApiError } from '../lib/api';
import {
  confirmHandover,
  getDemoPartners,
  normaliseCode,
  offerReward,
  partnerLogin,
  useRedemption,
  type DemoPartners,
  type PartnerCredentials,
} from '../lib/partner-api';
import DemoChip from './DemoChip.vue';

const STORE_KEY = 'secondlife.partner';
const uid = useId();

const creds = ref<PartnerCredentials | null>(null);
const partner = ref<Partner | null>(null);
const approved = ref(false);
const demo = ref<DemoPartners | null>(null);

const idInput = ref('');
const pinInput = ref('');
const loginError = ref('');
const loggingIn = ref(false);

interface Action {
  value: string;
  busy: boolean;
  error: string;
  result: string;
}
const blank = (): Action => ({ value: '', busy: false, error: '', result: '' });
const handover = ref(blank());
const redeem = ref(blank());
const reward = ref({ title: '', description: '', points: '', busy: false, error: '', result: '' });

const message = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
const area = (p: { state: string; district: string | null }) =>
  [p.district, isStateCode(p.state) ? INDIAN_STATES[p.state] : p.state].filter(Boolean).join(', ');

function remember(c: PartnerCredentials | null) {
  try {
    if (c) sessionStorage.setItem(STORE_KEY, JSON.stringify(c));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable: the login just won't survive a reload */
  }
}

async function signIn(c: PartnerCredentials, quiet = false) {
  loggingIn.value = true;
  loginError.value = '';
  try {
    const res = await partnerLogin(c);
    creds.value = c;
    partner.value = res.partner;
    approved.value = res.status === 'approved';
    pinInput.value = '';
    remember(c);
  } catch (err) {
    if (!quiet) loginError.value = message(err);
    else remember(null);
  } finally {
    loggingIn.value = false;
  }
}

function submitLogin() {
  const partnerId = idInput.value.trim();
  const pin = pinInput.value.trim();
  if (!partnerId || !pin) {
    loginError.value = 'Please enter your partner ID and PIN.';
    return;
  }
  void signIn({ partnerId, pin });
}

function logout() {
  creds.value = partner.value = null;
  handover.value = blank();
  redeem.value = blank();
  reward.value = { title: '', description: '', points: '', busy: false, error: '', result: '' };
  remember(null);
}

function pickDemo(id: string) {
  idInput.value = id;
  pinInput.value = demo.value?.pin ?? '';
  loginError.value = '';
  document.getElementById(`${uid}-pin`)?.focus();
}

const canConfirm = computed(() => approved.value);

async function runCode(a: Action, prefix: 'SL' | 'RW', call: (c: string) => Promise<string>) {
  const code = normaliseCode(a.value, prefix);
  a.error = a.result = '';
  if (code.length < 5) {
    a.error = `Please enter the code, like ${prefix}-7K4Q9X.`;
    return;
  }
  a.value = code;
  a.busy = true;
  try {
    a.result = await call(code);
    a.value = '';
  } catch (err) {
    a.error = message(err);
  } finally {
    a.busy = false;
  }
}

const doHandover = () =>
  runCode(handover.value, 'SL', async (code) => {
    const r = await confirmHandover(creds.value!, code);
    const verb = { donate: 'donated', recycle: 'recycled', repair: 'repair of' }[r.action];
    return `Confirmed: ${verb} ${r.device} · +${r.points} points for the customer`;
  });
const doRedeem = () =>
  runCode(redeem.value, 'RW', async (code) => {
    const r = await useRedemption(creds.value!, code);
    return `Marked as used: ${r.title}`;
  });

async function doOffer() {
  const r = reward.value;
  const points = Number(r.points);
  r.error = r.result = '';
  if (r.title.trim().length < 3) r.error = 'Give the reward a title of at least 3 characters.';
  else if (r.description.trim().length > 200) r.error = 'Keep the description under 200 characters.';
  else if (!Number.isInteger(points) || points < 10 || points > 5000) r.error = 'Points must be a whole number from 10 to 5000.';
  if (r.error) return;
  r.busy = true;
  try {
    const created = await offerReward(creds.value!, { title: r.title.trim(), description: r.description.trim(), points });
    r.result = `Reward added: ${created.title} · ${created.points} points`;
    r.title = r.description = r.points = '';
  } catch (err) {
    r.error = message(err);
  } finally {
    r.busy = false;
  }
}

onMounted(async () => {
  demo.value = await getDemoPartners();
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && typeof saved.partnerId === 'string' && typeof saved.pin === 'string') await signIn(saved, true);
  } catch {
    /* no saved login */
  }
});

defineExpose({ signIn });

const input =
  'block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500';
const label = 'mb-1.5 block text-sm font-medium text-stone-800';
const btn =
  'min-h-11 rounded-full bg-emerald-600 px-5 text-base font-semibold text-white shadow-xs transition hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-500/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const card = 'rounded-3xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6';
</script>

<template>
  <section :class="card" :aria-labelledby="`${uid}-h`">
    <h2 :id="`${uid}-h`" class="text-lg font-semibold tracking-tight text-stone-900">Partner tools</h2>

    <!-- Login -->
    <div v-if="!partner">
      <p class="mt-1 text-sm text-stone-600">Already listed? Log in with your partner ID and PIN.</p>

      <div v-if="demo" class="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
        <p class="flex items-start gap-2 text-sm font-medium text-amber-950">
          <FlaskConical class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Trying the hackathon demo? Log in as any demo partner with PIN <span class="font-mono font-semibold select-all">{{ demo.pin }}</span></span>
        </p>
        <ul class="mt-3 space-y-1.5">
          <li v-for="p in demo.partners" :key="p.id">
            <button type="button" class="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-left hover:border-amber-400 focus-visible:ring-4 focus-visible:ring-amber-500/20 focus-visible:outline-none" @click="pickDemo(p.id)">
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-stone-900">{{ p.name }}</span>
                <span class="block truncate text-xs text-stone-500">{{ area(p) }}</span>
              </span>
              <DemoChip />
            </button>
          </li>
        </ul>
      </div>

      <form class="mt-4 space-y-4" novalidate @submit.prevent="submitLogin">
        <div>
          <label :for="`${uid}-id`" :class="label">Partner ID</label>
          <input :id="`${uid}-id`" v-model="idInput" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" :class="input" />
        </div>
        <div>
          <label :for="`${uid}-pin`" :class="label">PIN</label>
          <input :id="`${uid}-pin`" v-model="pinInput" type="password" autocomplete="current-password" :class="input" />
        </div>
        <p v-if="loginError" role="alert" class="text-sm text-red-700">{{ loginError }}</p>
        <button type="submit" :disabled="loggingIn" :class="btn">{{ loggingIn ? 'Checking…' : 'Log in' }}</button>
      </form>
    </div>

    <!-- Tools -->
    <div v-else class="mt-3 space-y-6">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 font-semibold text-stone-900">
            <span class="break-words">{{ partner.name }}</span>
            <DemoChip v-if="partner.demo" />
          </p>
          <p v-if="!approved" class="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Awaiting approval</p>
        </div>
        <button type="button" class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-xs hover:bg-stone-100 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:outline-none" @click="logout">
          <LogOut class="size-4" aria-hidden="true" />
          Log out
        </button>
      </div>

      <p v-if="!approved" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Your shop is waiting for approval. Once it’s approved you can confirm handovers and offer rewards.
      </p>

      <form class="border-t border-stone-100 pt-5" novalidate @submit.prevent="doHandover">
        <h3 class="font-semibold text-stone-900">Confirm a handover</h3>
        <p class="mt-1 text-sm text-stone-600">Enter the code the customer shows you, like SL-7K4Q9X.</p>
        <label :for="`${uid}-sl`" class="sr-only">Handover code</label>
        <div class="mt-3 flex gap-2">
          <input :id="`${uid}-sl`" v-model="handover.value" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="SL-7K4Q9X" :disabled="!canConfirm" :class="[input, 'font-mono uppercase']" @input="handover.value = handover.value.toUpperCase()" />
          <button type="submit" :disabled="!canConfirm || handover.busy" :class="[btn, 'shrink-0']">{{ handover.busy ? 'Checking…' : 'Confirm' }}</button>
        </div>
        <p v-if="handover.error" role="alert" class="mt-2 text-sm text-red-700">{{ handover.error }}</p>
        <p v-if="handover.result" role="status" class="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{{ handover.result }}</p>
      </form>

      <form class="border-t border-stone-100 pt-5" novalidate @submit.prevent="doRedeem">
        <h3 class="font-semibold text-stone-900">Mark a reward code as used</h3>
        <p class="mt-1 text-sm text-stone-600">Enter the reward code the customer shows you, like RW-3MX8PQ.</p>
        <label :for="`${uid}-rw`" class="sr-only">Reward code</label>
        <div class="mt-3 flex gap-2">
          <input :id="`${uid}-rw`" v-model="redeem.value" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="RW-3MX8PQ" :disabled="!canConfirm" :class="[input, 'font-mono uppercase']" @input="redeem.value = redeem.value.toUpperCase()" />
          <button type="submit" :disabled="!canConfirm || redeem.busy" :class="[btn, 'shrink-0']">{{ redeem.busy ? 'Checking…' : 'Mark used' }}</button>
        </div>
        <p v-if="redeem.error" role="alert" class="mt-2 text-sm text-red-700">{{ redeem.error }}</p>
        <p v-if="redeem.result" role="status" class="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{{ redeem.result }}</p>
      </form>

      <form class="border-t border-stone-100 pt-5" novalidate @submit.prevent="doOffer">
        <h3 class="font-semibold text-stone-900">Offer a reward</h3>
        <p class="mt-1 text-sm text-stone-600">
          {{ approved ? 'Customers spend their points on rewards like a free health check or a discount.' : 'Available once your shop is approved.' }}
        </p>
        <fieldset :disabled="!approved || reward.busy" class="mt-3 space-y-4">
          <div>
            <label :for="`${uid}-rt`" :class="label">Reward title</label>
            <input :id="`${uid}-rt`" v-model="reward.title" type="text" maxlength="80" placeholder="Free phone health check" :class="input" />
          </div>
          <div>
            <label :for="`${uid}-rd`" :class="label">Description</label>
            <textarea :id="`${uid}-rd`" v-model="reward.description" rows="2" maxlength="200" :class="[input, 'py-2']" />
          </div>
          <div>
            <label :for="`${uid}-rp`" :class="label">Points cost (10 to 5000)</label>
            <input :id="`${uid}-rp`" v-model="reward.points" type="number" inputmode="numeric" min="10" max="5000" step="1" :class="input" />
          </div>
          <button type="submit" :class="btn">{{ reward.busy ? 'Adding…' : 'Add reward' }}</button>
        </fieldset>
        <p v-if="reward.error" role="alert" class="mt-2 text-sm text-red-700">{{ reward.error }}</p>
        <p v-if="reward.result" role="status" class="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{{ reward.result }}</p>
      </form>
    </div>
  </section>
</template>
