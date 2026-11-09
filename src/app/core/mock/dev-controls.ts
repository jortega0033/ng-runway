/**
 * Switches the dev toolbar flips to make the mock API misbehave on purpose.
 * Kept in plain storage so the mock worker and the toolbar read the same values.
 */
export interface DevControls {
  /** Extra delay on every response, in milliseconds. */
  slowMs: number;
  /** Chance (0 to 1) that a request fails with a 500. */
  errorRate: number;
  /** When true, list endpoints answer with no items. */
  empty: boolean;
}

export const DEV_CONTROLS_KEY = 'ng-runway.dev';

export const DEFAULT_DEV_CONTROLS: DevControls = { slowMs: 0, errorRate: 0, empty: false };

export function readDevControls(storage: Pick<Storage, 'getItem'> | null): DevControls {
  try {
    const raw = storage?.getItem(DEV_CONTROLS_KEY);
    if (!raw) return { ...DEFAULT_DEV_CONTROLS };
    return { ...DEFAULT_DEV_CONTROLS, ...(JSON.parse(raw) as Partial<DevControls>) };
  } catch {
    return { ...DEFAULT_DEV_CONTROLS };
  }
}

export function writeDevControls(
  storage: Pick<Storage, 'setItem'> | null,
  value: DevControls,
): void {
  try {
    storage?.setItem(DEV_CONTROLS_KEY, JSON.stringify(value));
  } catch {
    // Ignore: the toolbar just will not remember its state.
  }
}
