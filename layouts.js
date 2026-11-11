// Keyboard layout helpers shared by the background script and the popup.
import { LAYOUTS } from './layout-data.js';

export { LAYOUTS };

// Used when nothing else is known; matches the behaviour of earlier versions
export const FALLBACK_LAYOUT = 'us';

// The spacing character each dead key produces when followed by Space
export const DEAD_KEY_CHARS = {
  '̀': '`', '́': '´', '̂': '^', '̃': '~', '̄': '¯',
  '̆': '˘', '̇': '˙', '̈': '¨', '̊': '˚',
  '̋': '˝', '̌': 'ˇ', '̧': '¸', '̨': '˛'
};

export function getLayout(id) {
  return LAYOUTS.find(layout => layout.id === id) || null;
}

export function hasDeadKeys(layout) {
  return Object.values(layout.keys).some(levels => levels.some(value => value.startsWith('◌')));
}

// Finds the layout that best matches navigator.keyboard.getLayoutMap(), which tells
// which character each physical key types on this computer (without modifiers).
export function matchLayout(layoutMap) {
  const typed = {};
  for (const [code, char] of Object.entries(layoutMap || {})) {
    typed[code] = char.toLowerCase();
  }
  // Fewest differences wins. Several layouts can look the same without modifiers
  // (e.g. English (US) and Polish), and then the one listed first wins.
  let best = null;
  let fewestDifferences = Infinity;
  for (const layout of LAYOUTS) {
    let matches = 0;
    let differences = 0;
    for (const [code, levels] of Object.entries(layout.keys)) {
      if (!(code in typed) || !levels[0]) continue;
      let ours = levels[0];
      if (ours.startsWith('◌')) {
        // Browsers report dead keys either as the accent or as the spacing character
        const mark = ours.slice(1);
        ours = typed[code] === mark ? mark : DEAD_KEY_CHARS[mark];
      }
      if (ours === typed[code]) matches++;
      else differences++;
    }
    if (matches >= 20 && differences < fewestDifferences) {
      best = layout;
      fewestDifferences = differences;
    }
  }
  return best ? best.id : null;
}

// Detects this computer's layout. Works in Chromium-based browsers in a secure,
// top-level page (the popup, or the top frame of a tab).
export async function detectLayout() {
  try {
    if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) return null;
    return matchLayout(Object.fromEntries(await navigator.keyboard.getLayoutMap()));
  } catch (err) {
    return null;
  }
}
