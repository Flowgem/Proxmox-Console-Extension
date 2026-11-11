import { getLayout, matchLayout, FALLBACK_LAYOUT } from './layouts.js';

// Reads the keyboard layout of this computer through the tab's top frame
async function detectLayoutInTab(tabId) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) return null;
        return Object.fromEntries(await navigator.keyboard.getLayoutMap());
      }
    });
    return injection && injection.result ? matchLayout(injection.result) : null;
  } catch (err) {
    return null;
  }
}

// Works out which keyboard layout the VM uses, and whether it has dead keys
async function getKeyboardSettings(tabId) {
  const settings = await chrome.storage.local.get(['keyboardLayout', 'detectedLayout', 'deadKeys']);
  let layoutId = settings.keyboardLayout || 'auto';
  if (layoutId === 'auto') {
    layoutId = (tabId && await detectLayoutInTab(tabId)) || settings.detectedLayout || FALLBACK_LAYOUT;
  }
  return {
    layout: getLayout(layoutId) || getLayout(FALLBACK_LAYOUT),
    deadKeys: settings.deadKeys !== false
  };
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'paste-clipboard') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && !tabs[0].url.startsWith('chrome://')) {
        chrome.storage.local.get(['typingSpeed'], function(result) {
          const savedSpeed = result.typingSpeed || 75;

          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }).then(async () => {
            const keyboard = await getKeyboardSettings(tabs[0].id);

            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setTypingSpeed',
              speed: savedSpeed
            }).catch(() => {});

            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, {action: 'keyboard-shortcut', keyboard}).catch(() => {});
            }, 100);
          }).catch(err => {
            console.error('Error running script:', err);
          });
        });
      }
    });
  }
});

// Content scripts can ask for the keyboard settings when they paste on their own
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getKeyboardSettings') {
    getKeyboardSettings(sender.tab && sender.tab.id).then(sendResponse);
    return true;
  }
});
