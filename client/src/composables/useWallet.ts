import { ref } from 'vue';
import type { WalletEntry } from '../../../shared/schemas';
import { getWallet } from '../lib/rewards-api';

// Module-level: one wallet for the whole app.
const points = ref(0);
const demoPoints = ref(0);
const history = ref<WalletEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
let inflight: AbortController | null = null;

async function refresh(): Promise<void> {
  inflight?.abort();
  const controller = (inflight = new AbortController());
  loading.value = true;
  try {
    const w = await getWallet(controller.signal);
    points.value = w.points;
    demoPoints.value = w.demoPoints;
    history.value = w.history;
    error.value = null;
  } catch (err) {
    if (controller.signal.aborted) return;
    error.value = err instanceof Error ? err.message : 'Couldn’t load your points.';
  } finally {
    if (inflight === controller) {
      loading.value = false;
      inflight = null;
    }
  }
}

/** Applies a wallet the server just returned (e.g. after redeeming). */
function apply(w: { points: number; demoPoints: number; history: WalletEntry[] }) {
  points.value = w.points;
  demoPoints.value = w.demoPoints;
  history.value = w.history;
}

export function useWallet() {
  return { points, demoPoints, history, loading, error, refresh, apply };
}
