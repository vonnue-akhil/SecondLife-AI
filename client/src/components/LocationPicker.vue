<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { LoaderCircle, LocateFixed, MapPin, MapPinCheck, ShieldCheck, X } from '@lucide/vue';
import { INDIAN_STATES, isStateCode, type StateCode } from '../../../shared/india-states';
import { LocationError, useLocation } from '../composables/useLocation';

const props = withDefaults(defineProps<{ variant?: 'hero' | 'docked'; disabled?: boolean }>(), {
  variant: 'docked',
  disabled: false,
});

const { location, locating, label, detect, choose, clear } = useLocation();

const uid = useId();
const dialog = ref<HTMLDialogElement | null>(null);
const error = ref<string | null>(null);
const stateCode = ref<StateCode | ''>('');
const city = ref('');

const isHero = computed(() => props.variant === 'hero');
const states = (Object.entries(INDIAN_STATES) as [StateCode, string][]).sort((a, b) => a[1].localeCompare(b[1]));

/** e.g. "Near Kochi, Ernakulam district, Kerala". */
const detail = computed(() => {
  const l = location.value;
  if (!l) return null;
  const parts = [l.place && (l.source === 'device' ? `Near ${l.place}` : l.place), l.district && `${l.district} district`, INDIAN_STATES[l.state]];
  return parts.filter(Boolean).join(', ');
});

function open() {
  error.value = null;
  const l = location.value;
  stateCode.value = l?.state ?? '';
  city.value = l?.source === 'manual' ? (l.place ?? '') : '';
  dialog.value?.showModal();
}

const close = () => dialog.value?.close();

/** A click on the backdrop lands on the <dialog> element itself. */
function onDialogClick(e: MouseEvent) {
  if (e.target === dialog.value) close();
}

async function useDevice() {
  error.value = null;
  try {
    await detect();
    close();
  } catch (err) {
    error.value = err instanceof LocationError ? err.message : 'Something went wrong. Please choose your state below.';
  }
}

function saveManual() {
  if (!isStateCode(stateCode.value)) return;
  choose(stateCode.value, city.value);
  close();
}

function remove() {
  clear();
  close();
}
</script>

<template>
  <button
    type="button"
    class="inline-flex h-11 min-w-0 shrink items-center justify-center gap-2 rounded-full text-sm font-medium transition hover:bg-stone-100 disabled:opacity-50"
    :class="[
      isHero ? 'px-3' : 'w-11 shrink-0',
      location ? 'text-emerald-800 hover:text-emerald-900' : 'text-stone-600 hover:text-stone-900',
    ]"
    :disabled="disabled"
    :aria-label="label ? `Your area: ${label}. Change` : 'Add your area for local advice'"
    :title="label ?? 'Add your area'"
    @click="open"
  >
    <MapPinCheck v-if="location" class="size-5 shrink-0" aria-hidden="true" />
    <MapPin v-else class="size-5 shrink-0" aria-hidden="true" />
    <span v-if="isHero" class="max-w-[9rem] truncate sm:max-w-[14rem]" aria-hidden="true">
      {{ location?.place ?? (location ? INDIAN_STATES[location.state] : 'Add area') }}
    </span>
  </button>

  <!-- Teleported: the picker sits inside the composer's <form>, and forms can't nest. -->
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="mt-auto mb-0 w-full max-w-none rounded-t-3xl border border-stone-200 bg-white text-stone-800 shadow-xl backdrop:bg-stone-900/40 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-md sm:rounded-3xl open:motion-safe:animate-rise"
      :aria-labelledby="`${uid}-title`"
      @click="onDialogClick"
    >
      <div class="pb-safe px-5 pt-5 sm:pb-5">
        <div class="flex items-start gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <MapPin class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1 pt-0.5">
            <h2 :id="`${uid}-title`" class="text-base leading-snug font-semibold text-stone-900">Where are you?</h2>
            <p class="mt-0.5 text-sm leading-snug text-stone-600">
              Knowing your area lets SecondLife tailor its advice to where you are.
            </p>
          </div>
          <button
            type="button"
            class="-mt-1.5 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
            @click="close"
          >
            <X class="size-5" aria-hidden="true" />
          </button>
        </div>

        <div
          v-if="detail"
          class="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-3.5 py-2.5 ring-1 ring-emerald-200 ring-inset"
        >
          <MapPinCheck class="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <p class="min-w-0 flex-1 text-sm leading-snug text-emerald-900">
            <span class="sr-only">Current area: </span>{{ detail }}
          </p>
          <button
            type="button"
            class="-my-1 shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium text-emerald-800 underline-offset-2 transition hover:bg-emerald-100 hover:underline"
            @click="remove"
          >
            Remove
          </button>
        </div>

        <button
          type="button"
          class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-[15px] font-medium text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] disabled:bg-emerald-700/70"
          :disabled="locating"
          @click="useDevice"
        >
          <LoaderCircle v-if="locating" class="size-5 motion-safe:animate-spin" aria-hidden="true" />
          <LocateFixed v-else class="size-5" aria-hidden="true" />
          {{ locating ? 'Finding your area…' : 'Use my current location' }}
        </button>
        <p v-if="error" role="alert" class="mt-2 px-1 text-sm leading-snug text-red-700 motion-safe:animate-fade">{{ error }}</p>

        <div class="my-4 flex items-center gap-3 text-xs font-medium text-stone-400" aria-hidden="true">
          <span class="h-px flex-1 bg-stone-200" />
          or choose it yourself
          <span class="h-px flex-1 bg-stone-200" />
        </div>

        <form class="space-y-3" @submit.prevent="saveManual">
          <div>
            <label :for="`${uid}-state`" class="mb-1 block text-sm font-medium text-stone-700">State or union territory</label>
            <select
              :id="`${uid}-state`"
              v-model="stateCode"
              required
              class="block h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none sm:text-sm"
            >
              <option value="" disabled>Choose…</option>
              <option v-for="[code, name] in states" :key="code" :value="code">{{ name }}</option>
            </select>
          </div>
          <div>
            <label :for="`${uid}-city`" class="mb-1 block text-sm font-medium text-stone-700">
              City or town <span class="font-normal text-stone-400">(optional)</span>
            </label>
            <input
              :id="`${uid}-city`"
              v-model="city"
              type="text"
              maxlength="80"
              autocomplete="address-level2"
              placeholder="e.g. Kochi"
              class="block h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none sm:text-sm"
            />
          </div>
          <button
            type="submit"
            class="flex h-11 w-full items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
            :disabled="!stateCode"
          >
            Save area
          </button>
        </form>

        <p class="mt-4 flex gap-2 text-xs leading-relaxed text-stone-500">
          <ShieldCheck class="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            Your exact position never leaves this device. SecondLife finds the nearest town on your device and shares only
            the town, district and state. It’s remembered on this device until you remove it.
          </span>
        </p>
      </div>
    </dialog>
  </Teleport>
</template>
