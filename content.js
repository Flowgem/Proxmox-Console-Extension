if (typeof autoModeEnabled === 'undefined') {
  var autoModeEnabled = false;
}
if (typeof lastFocusedElement === 'undefined') {
  var lastFocusedElement = null;
}
if (typeof typingSpeed === 'undefined') {
  var typingSpeed = 75; // Default speed (ms between keystrokes)
}
if (typeof messageHandler === 'undefined') {
  var messageHandler = (request, sender, sendResponse) => {
    if (request.action === 'paste') {
      handlePaste();
    } else if (request.action === 'setAutoMode') {
      autoModeEnabled = request.enabled;
    } else if (request.action === 'setTypingSpeed') {
      typingSpeed = request.speed;
    }
  };
}
if (typeof shortcutHandler === 'undefined') {
  var shortcutHandler = (request, sender, sendResponse) => {
    if (request.action === 'keyboard-shortcut') {
      handlePaste(request.keyboard);
    }
  };
}

// VM consoles such as noVNC send the physical key (KeyboardEvent.code) to the VM, and
// the VM's own keyboard layout decides which character it becomes. So for every
// character we press the keys the VM's layout expects, using the layout tables in
// layout-data.js. This script is injected more than once per page, so it uses var.
var DEAD_KEY_MARKER = '◌';
var DEAD_KEY_CHARS = {
  '̀': '`', '́': '´', '̂': '^', '̃': '~', '̄': '¯',
  '̆': '˘', '̇': '˙', '̈': '¨', '̊': '˚',
  '̋': '˝', '̌': 'ˇ', '̧': '¸', '̨': '˛'
};

// Windows key codes (keyCode), for consoles that don't look at KeyboardEvent.code
var LEGACY_KEY_CODES = {
  Backquote: 192, Minus: 189, Equal: 187, BracketLeft: 219, BracketRight: 221, Backslash: 220,
  Semicolon: 186, Quote: 222, Comma: 188, Period: 190, Slash: 191, IntlBackslash: 226,
  IntlRo: 193, IntlYen: 255, Space: 32, Enter: 13, Tab: 9
};

function getLegacyKeyCode(code) {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
  return LEGACY_KEY_CODES[code] || 0;
}

// Builds lookup tables: character → key, and accent → dead key.
// When a character can be typed in several ways, keys with fewer modifiers win, and
// symbol keys win over AltGr on letter keys (those differ more between OS versions).
function buildKeyMap(keyboard) {
  const direct = {};
  const dead = {};
  const layoutKeys = (keyboard && keyboard.layout && keyboard.layout.keys) || {};
  const useDeadKeys = !keyboard || keyboard.deadKeys !== false;
  const isLetterKey = (code) => /^Key[A-Z]$/.test(code);
  const keyList = Object.entries(layoutKeys).sort((a, b) => isLetterKey(a[0]) - isLetterKey(b[0]));
  for (let level = 0; level < 4; level++) {
    for (const [code, levels] of keyList) {
      const value = levels[level];
      if (!value) continue;
      const key = { code, shift: level % 2 === 1, altgr: level >= 2 };
      if (value[0] === DEAD_KEY_MARKER) {
        const mark = value.slice(1);
        if (useDeadKeys) {
          if (!dead[mark]) dead[mark] = key;
        } else if (DEAD_KEY_CHARS[mark] && !direct[DEAD_KEY_CHARS[mark]]) {
          // The VM has no dead keys, so this key types the accent itself
          direct[DEAD_KEY_CHARS[mark]] = key;
        }
      } else if (!direct[value]) {
        direct[value] = key;
      }
    }
  }
  if (!direct[' ']) direct[' '] = { code: 'Space', shift: false, altgr: false };
  return { direct, dead };
}

// Returns the keystrokes needed to type one character
function getStrokes(char, keyMap) {
  if (char === '\n') return [{ key: 'Enter', code: 'Enter' }];
  if (char === '\t') return [{ key: 'Tab', code: 'Tab' }];

  const { direct, dead } = keyMap;
  const stroke = (key, value) => Object.assign({ key: value }, key);

  if (direct[char]) {
    return [stroke(direct[char], char)];
  }

  // An accent on its own: dead key followed by Space
  for (const [mark, spacing] of Object.entries(DEAD_KEY_CHARS)) {
    if (spacing === char && dead[mark]) {
      return [stroke(dead[mark], 'Dead'), stroke(direct[' '], ' ')];
    }
  }

  // Accented letter (é, ü, ñ …): dead key followed by the base letter
  const [base, mark, ...rest] = char.normalize('NFD');
  if (mark && rest.length === 0 && dead[mark] && direct[base]) {
    return [stroke(dead[mark], 'Dead'), stroke(direct[base], base)];
  }

  // Not on this layout: send the character without a physical key and let the console try
  return [{ key: char, code: '' }];
}

// Function to simulate text as keystrokes
async function simulateKeystrokes(text, keyboard) {
  // Windows line endings become a single Enter, non-breaking spaces become spaces
  text = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').normalize('NFC');
  const chars = Array.from(text);
  const keyMap = buildKeyMap(keyboard);

  const targetElement = lastFocusedElement || document.activeElement;

  // Add a short initial delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check whether we are in a VM console
  const isVMConsole = window.location.href.includes('spice') ||
                      window.location.href.includes('vnc') ||
                      document.querySelector('canvas#screen') ||
                      document.querySelector('div.console-container');

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const pause = (factor) => sleep(Math.max(5, typingSpeed * factor));
  const keyEvent = (type, init) => new KeyboardEvent(type, Object.assign({
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window
  }, init));

  // Sends one keystroke (with Shift and/or AltGr when needed) to the console
  async function typeStroke(canvas, stroke) {
    const keyCode = getLegacyKeyCode(stroke.code);
    const shiftKey = !!stroke.shift;
    const shiftInit = { key: 'Shift', code: 'ShiftLeft', keyCode: 16, which: 16, location: 1 };
    const altGrInit = { key: 'AltGraph', code: 'AltRight', keyCode: 18, which: 18, location: 2, shiftKey };

    if (stroke.shift) {
      canvas.dispatchEvent(keyEvent('keydown', Object.assign({ shiftKey: true }, shiftInit)));
      await pause(0.1);
    }
    if (stroke.altgr) {
      canvas.dispatchEvent(keyEvent('keydown', Object.assign({ modifierAltGraph: true }, altGrInit)));
      await pause(0.1);
    }

    const init = {
      key: stroke.key,
      code: stroke.code,
      keyCode: keyCode,
      which: keyCode,
      shiftKey: shiftKey,
      modifierAltGraph: !!stroke.altgr
    };
    canvas.dispatchEvent(keyEvent('keydown', init));
    await pause(0.15);

    // Browsers only send keypress for keys that type something
    if (stroke.key.length === 1 || stroke.key === 'Enter') {
      const charCode = stroke.key === 'Enter' ? 13 : stroke.key.charCodeAt(0);
      canvas.dispatchEvent(keyEvent('keypress', Object.assign({}, init, { keyCode: charCode, which: charCode, charCode: charCode })));
      await pause(0.15);
    }
    canvas.dispatchEvent(keyEvent('keyup', init));

    if (stroke.altgr) {
      await pause(0.1);
      canvas.dispatchEvent(keyEvent('keyup', altGrInit));
    }
    if (stroke.shift) {
      await pause(0.1);
      canvas.dispatchEvent(keyEvent('keyup', Object.assign({ shiftKey: false }, shiftInit)));
    }
  }

  // Use for...of instead of forEach so we can use async/await
  for (const char of chars) {
    if (isVMConsole) {
      // Define the canvas first
      const canvas = document.querySelector('canvas#screen') || targetElement;

      for (const stroke of getStrokes(char, keyMap)) {
        // Wait briefly before the next keystroke
        await pause(0.1);
        await typeStroke(canvas, stroke);
        // Longer delay between characters (needed for Edge)
        await sleep(typingSpeed);
      }
    } else {
      // Wait briefly before the next character
      await pause(0.1);

      // Regular input fields
      if (!targetElement || !targetElement.isContentEditable && !['INPUT', 'TEXTAREA'].includes(targetElement.tagName)) {
        console.error('No valid input field selected');
        return;
      }

      // Existing code for regular input fields
      const keydownEvent = new KeyboardEvent('keydown', {
        key: char,
        code: 'Key' + char.toUpperCase(),
        charCode: char.charCodeAt(0),
        keyCode: char.charCodeAt(0),
        which: char.charCodeAt(0),
        bubbles: true,
        cancelable: true
      });

      targetElement.dispatchEvent(keydownEvent);

      // Simulate input event
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true
      });
      targetElement.dispatchEvent(inputEvent);

      // Simulate keyup
      const keyupEvent = new KeyboardEvent('keyup', {
        key: char,
        code: 'Key' + char.toUpperCase(),
        charCode: char.charCodeAt(0),
        keyCode: char.charCodeAt(0),
        which: char.charCodeAt(0),
        bubbles: true,
        cancelable: true
      });
      targetElement.dispatchEvent(keyupEvent);

      // For input and textarea elements, update the value directly
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        const start = targetElement.selectionStart;
        const end = targetElement.selectionEnd;
        const currentValue = targetElement.value;
        targetElement.value = currentValue.substring(0, start) + char + currentValue.substring(end);
        targetElement.setSelectionRange(start + char.length, start + char.length);
      }
    }
  }
}

// Remove existing listeners (if any) and add new ones
if (chrome.runtime.onMessage.hasListeners()) {
  chrome.runtime.onMessage.removeListener(messageHandler);
  chrome.runtime.onMessage.removeListener(shortcutHandler);
}
chrome.runtime.onMessage.addListener(messageHandler);
chrome.runtime.onMessage.addListener(shortcutHandler);

// Function to handle pasting
async function handlePaste(keyboard) {
  try {
    // Ask the background script for the keyboard layout if we didn't get it
    if (!keyboard) {
      keyboard = await chrome.runtime.sendMessage({ action: 'getKeyboardSettings' }).catch(() => null);
    }

    // Try navigator.clipboard first
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (clipboardErr) {
      // Fall back to execCommand if navigator.clipboard fails
      const tempInput = document.createElement('textarea');
      document.body.appendChild(tempInput);
      tempInput.focus();
      document.execCommand('paste');
      text = tempInput.value;
      document.body.removeChild(tempInput);
    }

    if (text) {
      simulateKeystrokes(text, keyboard);
    } else {
      throw new Error('No text found on the clipboard');
    }
  } catch (err) {
    console.error('Error while pasting:', err.message);
  }
}

// Remember the last focused element
document.addEventListener('focusin', (event) => {
  lastFocusedElement = event.target;
});

// Event listener for automatic pasting
if (autoModeEnabled) {
  document.addEventListener('focus', (event) => {
    if (event.target.matches('textarea, input[type="text"]')) {
      handlePaste();
    }
  }, true);
}
