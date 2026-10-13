/**
 * Which shell tabs are usable in each preview mode.
 * 'run' = a generated map exists (it always records stage frames, so the Visualizer works too).
 */

import { PREVIEW } from '../config.js';

function getTabAvailability(mode) {
  const has = {
    run: mode !== PREVIEW.modes.previewMap,
  };
  return PREVIEW.tabs.map((t) => {
    const enabled = t.needs === null || has[t.needs] === true;
    return { id: t.id, label: t.label, path: t.path, enabled, reason: enabled ? '' : t.disabledReason };
  });
}

export function getTabState(mode) {
  const initial = PREVIEW.initialTab[mode] ?? PREVIEW.initialTab[PREVIEW.defaultMode];
  return { mode, initial, storageKey: PREVIEW.storageKey, tabs: getTabAvailability(mode) };
}
