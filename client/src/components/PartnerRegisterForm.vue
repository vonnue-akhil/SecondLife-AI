<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Check, Copy, X } from '@lucide/vue';
import { INDIAN_STATES, STATE_CODES, type StateCode } from '../../../shared/india-states';
import type { PartnerService } from '../../../shared/schemas';
import { ApiError } from '../lib/api';
import { registerPartner } from '../lib/partner-api';

const emit = defineEmits<{ registered: [creds: { partnerId: string; pin: string }] }>();

const uid = useId();
const SERVICES: { value: PartnerService; label: string }[] = [
  { value: 'repair', label: 'Repairs' },
  { value: 'donate', label: 'Accepts donated devices' },
  { value: 'recycle', label: 'Takes e-waste for recycling' },
];
const SUGGESTIONS = ['Phones', 'Laptops', 'Tablets', 'TVs', 'Audio', 'Washing machines', 'Fridges', 'ACs', 'Small appliances'];
const PLACE_RE = /^[\p{L}\p{M}\p{N} .,'()&-]+$/u;
const PHONE_RE = /^\+?[0-9][0-9 -]{8,15}[0-9]$/;

const name = ref('');
const services = ref<PartnerService[]>([]);
const devices = ref<string[]>([]);
const deviceInput = ref('');
const state = ref<StateCode | ''>('');
const district = ref('');
const place = ref('');
const phone = ref('');
const whatsapp = ref(false);
const consent = ref(false);

const errors = ref<Record<string, string>>({});
const formError = ref('');
const submitting = ref(false);
const done = ref<{ id: string; pin: string } | null>(null);
const copied = ref('');

const states = STATE_CODES.map((code) => ({ code, label: INDIAN_STATES[code] })).sort((a, b) => a.label.localeCompare(b.label));
const openSuggestions = computed(() => SUGGESTIONS.filter((s) => !devices.value.some((d) => d.toLowerCase() === s.toLowerCase())));

function addDevice(raw: string) {
  const label = raw.trim().replace(/,$/, '').trim();
  if (!label) return;
  if (label.length > 30) return void (errors.value = { ...errors.value, devices: 'Keep each device name under 30 characters.' });
  if (devices.value.length >= 8) return void (errors.value = { ...errors.value, devices: 'You can list up to 8 kinds of device.' });
  if (!devices.value.some((d) => d.toLowerCase() === label.toLowerCase())) devices.value = [...devices.value, label];
  deviceInput.value = '';
  const { devices: _drop, ...rest } = errors.value;
  errors.value = rest;
}
function onDeviceKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addDevice(deviceInput.value);
  }
}
const removeDevice = (d: string) => (devices.value = devices.value.filter((x) => x !== d));

function validate(): boolean {
  if (deviceInput.value.trim()) addDevice(deviceInput.value);
  const e: Record<string, string> = {};
  if (name.value.trim().length < 2) e.name = 'Please enter your shop’s name.';
  else if (name.value.trim().length > 80) e.name = 'Keep the name under 80 characters.';
  if (!services.value.length) e.services = 'Pick at least one service.';
  if (!devices.value.length) e.devices = 'Add at least one kind of device you handle.';
  if (!state.value) e.state = 'Please choose your state.';
  for (const [key, v, label] of [['district', district.value, 'district'], ['place', place.value, 'town or locality']] as const) {
    const t = v.trim();
    if (t && (t.length > 80 || !PLACE_RE.test(t))) e[key] = `Please check your ${label}: letters, numbers and simple punctuation only.`;
  }
  if (!PHONE_RE.test(phone.value.trim())) e.phone = 'Please enter a phone number with 10 to 12 digits.';
  if (!consent.value) e.consent = 'We need your agreement to list your shop.';
  errors.value = e;
  return !Object.keys(e).length;
}

async function submit() {
  if (submitting.value || !validate()) return;
  submitting.value = true;
  formError.value = '';
  try {
    const res = await registerPartner({
      name: name.value.trim(),
      services: services.value,
      devices: devices.value,
      state: state.value as StateCode,
      district: district.value.trim() || null,
      place: place.value.trim() || null,
      phone: phone.value.trim(),
      whatsapp: whatsapp.value,
      consent: true,
    });
    done.value = { id: res.id, pin: res.pin };
    emit('registered', { partnerId: res.id, pin: res.pin });
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
  } finally {
    submitting.value = false;
  }
}

async function copy(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = label;
    setTimeout(() => (copied.value = ''), 2000);
  } catch {
    copied.value = '';
  }
}

const input =
  'block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none';
const label = 'mb-1.5 block text-sm font-medium text-stone-800';
const err = 'mt-1.5 text-sm text-red-700';
</script>

<template>
  <section class="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6" :aria-labelledby="`${uid}-h`">
    <h2 :id="`${uid}-h`" class="text-lg font-semibold tracking-tight text-stone-900">Join as a partner</h2>

    <div v-if="done" class="mt-4" role="status">
      <p class="text-sm text-stone-700">Thank you. Your shop has been sent for approval. Here are your login details.</p>
      <div class="mt-4 space-y-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4">
        <div v-for="item in [{ k: 'Partner ID', v: done.id }, { k: 'PIN', v: done.pin }]" :key="item.k" class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold tracking-wide text-emerald-800 uppercase">{{ item.k }}</p>
            <p class="font-mono text-xl font-semibold break-all text-stone-900 select-all">{{ item.v }}</p>
          </div>
          <button
            type="button"
            class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-white px-3 text-sm font-medium text-emerald-800 shadow-xs hover:bg-emerald-100 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:outline-none"
            @click="copy(item.k, item.v)"
          >
            <Check v-if="copied === item.k" class="size-4" aria-hidden="true" />
            <Copy v-else class="size-4" aria-hidden="true" />
            {{ copied === item.k ? 'Copied' : `Copy ${item.k === 'PIN' ? 'PIN' : 'ID'}` }}
          </button>
        </div>
      </div>
      <p class="mt-3 text-sm font-medium text-stone-900">Save your PIN now; we can’t show it again. Your listing appears once it’s approved.</p>
      <p class="mt-1 text-sm text-stone-600">You’re signed in to the partner tools below.</p>
    </div>

    <form v-else class="mt-4 space-y-5" novalidate @submit.prevent="submit">
      <div>
        <label :for="`${uid}-name`" :class="label">Shop name</label>
        <input :id="`${uid}-name`" v-model="name" type="text" maxlength="80" autocomplete="organization" :class="input" :aria-invalid="!!errors.name" />
        <p v-if="errors.name" role="alert" :class="err">{{ errors.name }}</p>
      </div>

      <fieldset>
        <legend :class="label">What do you offer?</legend>
        <div class="space-y-1">
          <label v-for="s in SERVICES" :key="s.value" class="flex min-h-11 cursor-pointer items-center gap-3 text-base text-stone-800">
            <input v-model="services" type="checkbox" :value="s.value" class="size-5 rounded border-stone-300 accent-emerald-600 focus-visible:ring-4 focus-visible:ring-emerald-500/20" />
            {{ s.label }}
          </label>
        </div>
        <p v-if="errors.services" role="alert" :class="err">{{ errors.services }}</p>
      </fieldset>

      <div>
        <label :for="`${uid}-dev`" :class="label">Devices you handle</label>
        <ul v-if="devices.length" class="mb-2 flex flex-wrap gap-2" aria-label="Devices added">
          <li v-for="d in devices" :key="d" class="inline-flex items-center gap-1 rounded-full bg-emerald-100 py-1 pr-1 pl-3 text-sm text-emerald-900">
            {{ d }}
            <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-emerald-200 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:outline-none" :aria-label="`Remove ${d}`" @click="removeDevice(d)">
              <X class="size-4" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <div class="flex gap-2">
          <input :id="`${uid}-dev`" v-model="deviceInput" type="text" maxlength="30" placeholder="Type a device and press Enter" :class="input" :aria-invalid="!!errors.devices" @keydown="onDeviceKey" />
          <button type="button" class="min-h-11 shrink-0 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 shadow-xs hover:bg-stone-100 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:outline-none" @click="addDevice(deviceInput)">Add</button>
        </div>
        <div v-if="openSuggestions.length" class="mt-2 flex flex-wrap gap-2">
          <button v-for="s in openSuggestions" :key="s" type="button" class="min-h-9 rounded-full border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700 hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:outline-none" @click="addDevice(s)">+ {{ s }}</button>
        </div>
        <p v-if="errors.devices" role="alert" :class="err">{{ errors.devices }}</p>
      </div>

      <div>
        <label :for="`${uid}-state`" :class="label">State</label>
        <select :id="`${uid}-state`" v-model="state" :class="input" :aria-invalid="!!errors.state">
          <option value="" disabled>Choose your state</option>
          <option v-for="s in states" :key="s.code" :value="s.code">{{ s.label }}</option>
        </select>
        <p v-if="errors.state" role="alert" :class="err">{{ errors.state }}</p>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label :for="`${uid}-district`" :class="label">District</label>
          <input :id="`${uid}-district`" v-model="district" type="text" maxlength="80" :class="input" :aria-invalid="!!errors.district" />
          <p v-if="errors.district" role="alert" :class="err">{{ errors.district }}</p>
        </div>
        <div>
          <label :for="`${uid}-place`" :class="label">Town or locality</label>
          <input :id="`${uid}-place`" v-model="place" type="text" maxlength="80" :class="input" :aria-invalid="!!errors.place" />
          <p v-if="errors.place" role="alert" :class="err">{{ errors.place }}</p>
        </div>
      </div>

      <div>
        <label :for="`${uid}-phone`" :class="label">Phone number</label>
        <input :id="`${uid}-phone`" v-model="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" :class="input" :aria-invalid="!!errors.phone" />
        <p v-if="errors.phone" role="alert" :class="err">{{ errors.phone }}</p>
        <label class="mt-1 flex min-h-11 cursor-pointer items-center gap-3 text-base text-stone-800">
          <input v-model="whatsapp" type="checkbox" class="size-5 rounded border-stone-300 accent-emerald-600 focus-visible:ring-4 focus-visible:ring-emerald-500/20" />
          This number is on WhatsApp
        </label>
      </div>

      <div>
        <label class="flex cursor-pointer items-start gap-3 rounded-2xl bg-stone-50 p-3 text-sm text-stone-800">
          <input v-model="consent" type="checkbox" class="mt-0.5 size-5 shrink-0 rounded border-stone-300 accent-emerald-600 focus-visible:ring-4 focus-visible:ring-emerald-500/20" :aria-invalid="!!errors.consent" />
          I agree that SecondLife can show my shop’s name, area and phone number to people looking for repairs or drop-off points nearby.
        </label>
        <p v-if="errors.consent" role="alert" :class="err">{{ errors.consent }}</p>
      </div>

      <p v-if="formError" role="alert" class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{{ formError }}</p>

      <button type="submit" :disabled="submitting" class="min-h-11 w-full rounded-full bg-emerald-600 px-5 text-base font-semibold text-white shadow-xs transition hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-500/30 focus-visible:outline-none disabled:opacity-60">
        {{ submitting ? 'Sending…' : 'Send for approval' }}
      </button>
    </form>
  </section>
</template>
