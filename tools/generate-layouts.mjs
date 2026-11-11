#!/usr/bin/env node
// Generates layout-data.js from xkeyboard-config, the keyboard layout database used by Linux.
//
// Usage:
//   node tools/generate-layouts.mjs <xkeyboard-config dir> <keysymdef.h> [output file] [layout,layout(variant),...]
//
// Get the inputs from:
//   https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config  (release tarball)
//   https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/raw/master/include/X11/keysymdef.h
//
// Only the alphanumeric part of each layout is extracted: for every physical key, the
// characters produced with no modifier, Shift, AltGr and Shift+AltGr.

import fs from 'node:fs';
import path from 'node:path';

// Layouts to include, as xkb "layout" or "layout(variant)". Layouts that don't use the
// Latin alphabet are left out: VMs using them normally switch to a Latin layout for typing commands.
const LAYOUTS = [
  'us', 'us(intl)', 'gb',
  'de', 'ch', 'ch(fr)', 'fr', 'be', 'ca', 'es', 'latam', 'it', 'pt', 'br', 'nl',
  'dk', 'no', 'se', 'fi', 'is', 'fo',
  'cz', 'cz(qwerty)', 'sk', 'pl', 'hu', 'si', 'hr', 'ro', 'ee', 'lv', 'lt', 'tr',
  'jp'
];

// xkb key names → KeyboardEvent.code (the physical key)
const XKB_TO_CODE = {
  TLDE: 'Backquote', AE01: 'Digit1', AE02: 'Digit2', AE03: 'Digit3', AE04: 'Digit4', AE05: 'Digit5',
  AE06: 'Digit6', AE07: 'Digit7', AE08: 'Digit8', AE09: 'Digit9', AE10: 'Digit0', AE11: 'Minus',
  AE12: 'Equal', AE13: 'IntlYen',
  AD01: 'KeyQ', AD02: 'KeyW', AD03: 'KeyE', AD04: 'KeyR', AD05: 'KeyT', AD06: 'KeyY', AD07: 'KeyU',
  AD08: 'KeyI', AD09: 'KeyO', AD10: 'KeyP', AD11: 'BracketLeft', AD12: 'BracketRight',
  AC01: 'KeyA', AC02: 'KeyS', AC03: 'KeyD', AC04: 'KeyF', AC05: 'KeyG', AC06: 'KeyH', AC07: 'KeyJ',
  AC08: 'KeyK', AC09: 'KeyL', AC10: 'Semicolon', AC11: 'Quote', BKSL: 'Backslash', AC12: 'Backslash',
  LSGT: 'IntlBackslash',
  AB01: 'KeyZ', AB02: 'KeyX', AB03: 'KeyC', AB04: 'KeyV', AB05: 'KeyB', AB06: 'KeyN', AB07: 'KeyM',
  AB08: 'Comma', AB09: 'Period', AB10: 'Slash', AB11: 'IntlRo'
};
const CODE_ORDER = [...new Set(Object.values(XKB_TO_CODE))];

// Dead keysyms → the combining accent they add
const DEAD_KEYSYMS = {
  0xfe50: '̀', 0xfe51: '́', 0xfe52: '̂', 0xfe53: '̃', 0xfe54: '̄',
  0xfe55: '̆', 0xfe56: '̇', 0xfe57: '̈', 0xfe58: '̊', 0xfe59: '̋',
  0xfe5a: '̌', 0xfe5b: '̧', 0xfe5c: '̨', 0xfe60: '̣', 0xfe61: '̉',
  0xfe62: '̛', 0xfe64: '̓', 0xfe65: '̔', 0xfe66: '̏', 0xfe6e: '̦'
};
const DEAD_MARKER = '◌'; // ◌

// Key types where AltGr levels can't be reached
const LIMITED_TYPES = { ONE_LEVEL: 1, TWO_LEVEL: 2, ALPHABETIC: 2, KEYPAD: 2, PC_ALT_LEVEL2: 1, PC_CONTROL_LEVEL2: 1 };

const [xkbDir, keysymdefPath, outFile = 'layout-data.js', layoutList] = process.argv.slice(2);
const layoutSpecs = layoutList ? layoutList.split(',') : LAYOUTS;
if (!xkbDir || !keysymdefPath) {
  console.error('Usage: node tools/generate-layouts.mjs <xkeyboard-config dir> <keysymdef.h> [output file]');
  process.exit(1);
}

// --- keysym names → characters ---------------------------------------------

const keysyms = new Map(); // name → { value, char }
for (const line of fs.readFileSync(keysymdefPath, 'utf8').split('\n')) {
  const m = line.match(/^#define XK_(\w+)\s+0x([0-9a-f]+)\s*(?:\/\*\s*\(?U\+([0-9A-F]{4,6}))?/i);
  if (m) {
    keysyms.set(m[1], { value: parseInt(m[2], 16), char: m[3] ? String.fromCodePoint(parseInt(m[3], 16)) : null });
  }
}

function keysymToChar(name) {
  let value;
  if (/^U[0-9A-Fa-f]{4,6}$/.test(name)) return String.fromCodePoint(parseInt(name.slice(1), 16));
  if (/^0x[0-9a-f]+$/i.test(name)) value = parseInt(name, 16);
  else if (keysyms.has(name)) {
    const ks = keysyms.get(name);
    if (ks.char) return ks.char;
    value = ks.value;
  } else return '';
  if (DEAD_KEYSYMS[value]) return DEAD_MARKER + DEAD_KEYSYMS[value];
  if (value >= 0x20 && value <= 0xff) return String.fromCodePoint(value);
  if (value >= 0x1000100 && value <= 0x110ffff) return String.fromCodePoint(value - 0x1000000);
  return ''; // modifiers, function keys, NoSymbol …
}

// --- xkb symbols parser -----------------------------------------------------

function tokenize(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(\/\/|#).*$/gm, ' ');
  const re = /"([^"]*)"|<([^>]+)>|([A-Za-z0-9_+\-]+)|([{}[\]();,=.!])/g;
  const tokens = [];
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) tokens.push({ str: m[1] });
    else if (m[2] !== undefined) tokens.push({ keyname: m[2] });
    else tokens.push(m[3] || m[4]);
  }
  return tokens;
}

const fileCache = new Map();

function parseFile(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const tokens = tokenize(fs.readFileSync(path.join(xkbDir, 'symbols', file), 'utf8'));
  const sections = [];
  let i = 0;
  const flags = [];
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'xkb_symbols') {
      const name = tokens[i + 1].str;
      i += 3; // name and '{'
      const start = i;
      let depth = 1;
      while (depth > 0) {
        if (tokens[i] === '{') depth++;
        if (tokens[i] === '}') depth--;
        i++;
      }
      sections.push({ name, isDefault: flags.includes('default'), statements: parseStatements(tokens.slice(start, i - 1)) });
      flags.length = 0;
    } else {
      if (typeof t === 'string') flags.push(t);
      i++;
    }
  }
  fileCache.set(file, sections);
  return sections;
}

function parseStatements(tokens) {
  const statements = [];
  let i = 0;
  const skipStatement = () => {
    let depth = 0;
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t === '{' || t === '[') depth++;
      if (t === '}' || t === ']') depth--;
      if (t === ';' && depth === 0) return;
    }
  };
  while (i < tokens.length) {
    const t = tokens[i];
    const mergeMode = ['override', 'augment', 'replace'].includes(t) ? t : null;
    if ((t === 'include' || mergeMode) && tokens[i + 1] && tokens[i + 1].str !== undefined) {
      statements.push({ type: 'include', mode: mergeMode || 'override', spec: tokens[i + 1].str });
      i += 2;
      if (tokens[i] === ';') i++;
    } else if (t === 'key' && tokens[i + 1] === '.') {
      // key.type[Group1] = "..."; sets the default type for the following keys
      if (tokens[i + 2] === 'type') {
        let j = i + 3;
        let group = 1;
        if (tokens[j] === '[') { group = parseGroup(tokens[j + 1]); j += 3; }
        if (tokens[j] === '=' && group === 1) statements.push({ type: 'keytype', value: tokens[j + 1].str });
      }
      skipStatement();
    } else if (t === 'key' || (mergeMode && tokens[i + 1] === 'key')) {
      if (mergeMode) i++;
      const keyname = tokens[i + 1].keyname;
      i += 3; // key, <name>, {
      const start = i;
      let depth = 1;
      while (depth > 0) {
        if (tokens[i] === '{') depth++;
        if (tokens[i] === '}') depth--;
        i++;
      }
      statements.push({ type: 'key', mode: mergeMode || 'override', keyname, ...parseKeyBody(tokens.slice(start, i - 1)) });
      if (tokens[i] === ';') i++;
    } else if (t === 'name' && tokens[i + 1] === '[') {
      const value = tokens[i + 5] && tokens[i + 5].str;
      if (parseGroup(tokens[i + 2]) === 1 && value) statements.push({ type: 'name', value });
      skipStatement();
    } else {
      skipStatement();
    }
  }
  return statements;
}

function parseGroup(token) {
  const m = String(token).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

function readList(tokens, i) {
  // tokens[i] === '[' → returns [items, index after ']']
  const items = [];
  i++;
  while (tokens[i] !== ']') {
    if (tokens[i] !== ',') items.push(tokens[i]);
    i++;
  }
  return [items, i + 1];
}

function parseKeyBody(tokens) {
  let syms = null;
  let keyType = null;
  let positional = 0;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '[') {
      const [items, next] = readList(tokens, i);
      if (++positional === 1) syms = items;
      i = next;
    } else if (typeof t === 'string' && /^[A-Za-z]/.test(t)) {
      let j = i + 1;
      let group = 1;
      if (tokens[j] === '[') { group = parseGroup(tokens[j + 1]); j += 3; }
      if (tokens[j] === '=') {
        j++;
        if (tokens[j] === '[') {
          const [items, next] = readList(tokens, j);
          if (t === 'symbols' && group === 1) syms = items;
          j = next;
        } else {
          if (t === 'type' && group === 1 && tokens[j].str !== undefined) keyType = tokens[j].str;
          j++;
        }
      }
      i = j;
    } else {
      i++;
    }
  }
  return { syms, keyType };
}

// --- resolving includes and merging -------------------------------------------

function findSection(file, sectionName) {
  const sections = parseFile(file);
  const section = sectionName
    ? sections.find(s => s.name === sectionName)
    : sections.find(s => s.isDefault) || sections[0];
  if (!section) throw new Error(`Section not found: ${file}(${sectionName || ''})`);
  return section;
}

// "NoSymbol" and "any" leave a level as it was
const isEmptySym = (sym) => !sym || sym === 'NoSymbol' || sym === 'any';

function mergeKey(keys, keyname, entry, mode) {
  const old = keys.get(keyname);
  if (!old || mode === 'replace') {
    keys.set(keyname, { syms: entry.syms.map(sym => isEmptySym(sym) ? '' : sym), keyType: entry.keyType });
    return;
  }
  const syms = [...old.syms];
  entry.syms.forEach((sym, level) => {
    if (isEmptySym(sym)) return;
    if (mode === 'augment' && !isEmptySym(syms[level])) return;
    syms[level] = sym;
  });
  const keyType = mode === 'augment' ? old.keyType || entry.keyType : entry.keyType || old.keyType;
  keys.set(keyname, { syms, keyType });
}

function resolve(spec) {
  const m = spec.match(/^([\w\-\/]+)(?:\(([\w\-]+)\))?$/);
  if (!m) throw new Error('Bad include: ' + spec);
  const section = findSection(m[1], m[2]);
  const keys = new Map();
  let name = null;
  let defaultType = null;
  for (const st of section.statements) {
    if (st.type === 'include') {
      // "a(x)+b(y)" includes several sections in a row; "|" means augment
      const parts = st.spec.split(/(?=[+|])/);
      for (const part of parts) {
        const mode = part.startsWith('|') ? 'augment' : st.mode;
        const included = resolve(part.replace(/^[+|]/, ''));
        for (const [k, v] of included.keys) mergeKey(keys, k, v, mode);
        if (!name && included.name) name = included.name;
      }
    } else if (st.type === 'keytype') {
      defaultType = st.value;
    } else if (st.type === 'name') {
      name = st.value;
    } else if (st.type === 'key' && st.syms) {
      mergeKey(keys, st.keyname, { syms: st.syms, keyType: st.keyType || defaultType }, st.mode);
    }
  }
  return { keys, name };
}

// --- generate -----------------------------------------------------------------

function layoutId(spec) {
  return spec.replace(/\((\w+)\)/, '-$1');
}

const output = [];
for (const spec of layoutSpecs) {
  const { keys, name } = resolve(spec);
  const result = {};
  for (const code of CODE_ORDER) {
    const xkbNames = Object.keys(XKB_TO_CODE).filter(k => XKB_TO_CODE[k] === code);
    const entry = xkbNames.map(k => keys.get(k)).find(Boolean);
    if (!entry) continue;
    const maxLevels = LIMITED_TYPES[entry.keyType] || 4;
    const levels = entry.syms.slice(0, maxLevels).map(keysymToChar);
    while (levels.length && !levels[levels.length - 1]) levels.pop();
    if (levels.length) result[code] = levels;
  }

  // Linux adds the extra key next to left Shift (< >) from the pc105 base layout when a layout
  // doesn't define it. Only use it when < and > can't be typed without AltGr elsewhere, because
  // on US-based layouts Windows types \ with that key.
  if (!result.IntlBackslash) {
    const withoutAltGr = new Set(Object.values(result).flatMap(levels => levels.slice(0, 2)));
    if (!withoutAltGr.has('<') || !withoutAltGr.has('>')) {
      const pcKey = resolve('pc(pc105)').keys.get('LSGT');
      result.IntlBackslash = pcKey.syms.map(keysymToChar);
    }
  }

  output.push({ id: layoutId(spec), name, keys: result });
}

const version = (() => {
  try {
    const meson = fs.readFileSync(path.join(xkbDir, 'meson.build'), 'utf8');
    return meson.match(/version:\s*'([^']+)'/)[1];
  } catch (e) {
    return 'unknown';
  }
})();

const lines = [
  '// Generated by tools/generate-layouts.mjs from xkeyboard-config ' + version + '. Do not edit by hand.',
  '//',
  '// Keyboard layout data from xkeyboard-config (https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config),',
  '// which is distributed under MIT-style licenses; see the COPYING file in that project.',
  '//',
  '// For each physical key (KeyboardEvent.code): the characters for',
  '// [no modifier, Shift, AltGr, Shift+AltGr]. An empty string means nothing.',
  "// A dead key is written as '◌' followed by the combining accent it adds, e.g. '◌̃' (dead tilde).",
  '',
  'export const LAYOUTS = ['
];
output.forEach((layout, index) => {
  lines.push(`  {\n    id: ${JSON.stringify(layout.id)},\n    name: ${JSON.stringify(layout.name)},\n    keys: {`);
  const entries = Object.entries(layout.keys);
  entries.forEach(([code, levels], i) => {
    lines.push(`      ${code}: ${JSON.stringify(levels)}${i < entries.length - 1 ? ',' : ''}`);
  });
  lines.push(`    }\n  }${index < output.length - 1 ? ',' : ''}`);
});
lines.push('];', '');

fs.writeFileSync(outFile, lines.join('\n'));
console.log(`Wrote ${output.length} layouts to ${outFile}`);
for (const l of output) console.log(`  ${l.id.padEnd(12)} ${String(Object.keys(l.keys).length).padStart(2)} keys  ${l.name}`);
