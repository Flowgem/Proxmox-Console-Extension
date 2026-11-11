import { LAYOUTS, getLayout, hasDeadKeys, detectLayout, FALLBACK_LAYOUT } from './layouts.js';

// Translated text from _locales
function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

document.addEventListener('DOMContentLoaded', function() {
  const typingSpeed = document.getElementById('typingSpeed');
  const speedValue = document.getElementById('speedValue');
  const keyboardLayout = document.getElementById('keyboardLayout');
  const deadKeys = document.getElementById('deadKeys');
  const deadKeysRow = document.getElementById('deadKeysRow');

  // Fill in translated text
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  document.getElementById('footer').textContent = 'VM Console Extension v' + chrome.runtime.getManifest().version;

  // Function to reverse the value: 10 -> 200, 200 -> 10
  function reverseValue(value) {
    // Calculate the reversed value (10 becomes 200, 200 becomes 10)
    return 210 - value;
  }

  // Check whether this is an update, and show an update notice if needed
  chrome.storage.local.get(['lastVersion'], function(result) {
    const currentVersion = chrome.runtime.getManifest().version;
    const lastVersion = result.lastVersion || '0';

    // If this is an update from an older version
    if (lastVersion !== currentVersion) {
      // Save the new version
      chrome.storage.local.set({ lastVersion: currentVersion });

      // Only for updates, not for new installs
      if (lastVersion === '1.0' || lastVersion === '1.1') {
        // Show update notice
        showUpdateNotification(currentVersion);
      }
    }
  });

  // Function to show the update notice
  function showUpdateNotification(version) {
    // Create an overlay element
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';

    // Create the notice element
    const notification = document.createElement('div');
    notification.style.backgroundColor = 'white';
    notification.style.borderRadius = '8px';
    notification.style.padding = '20px';
    notification.style.maxWidth = '80%';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';

    // Content of the notice
    const title = document.createElement('h3');
    title.style.color = '#2E7D32';
    title.style.marginTop = '0';
    title.textContent = t('updateTitle', [version]);

    const intro = document.createElement('p');
    intro.textContent = t('updateIntro');

    const list = document.createElement('ul');
    list.style.paddingLeft = '20px';
    list.style.marginBottom = '15px';
    for (const key of ['updateItemLayouts', 'updateItemLines', 'updateItemLanguages']) {
      const item = document.createElement('li');
      item.textContent = t(key);
      list.appendChild(item);
    }

    const closeButton = document.createElement('button');
    closeButton.textContent = t('close');
    closeButton.style.cssText = 'background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; float: right;';

    const clear = document.createElement('div');
    clear.style.clear = 'both';

    notification.append(title, intro, list, closeButton, clear);

    // Add the notice to the overlay
    overlay.appendChild(notification);

    // Add the overlay to the body
    document.body.appendChild(overlay);

    // Close the notice when the button is clicked
    closeButton.addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
  }

  // Keyboard layout: "Automatic" (this computer's layout) or a fixed layout
  let detectedLayout = null;

  function fillLayoutList(selected) {
    keyboardLayout.textContent = '';
    const auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = detectedLayout
      ? t('layoutAuto', [getLayout(detectedLayout).name])
      : t('layoutAutoUnknown');
    keyboardLayout.appendChild(auto);

    const sorted = [...LAYOUTS].sort((a, b) => a.name.localeCompare(b.name));
    for (const layout of sorted) {
      const option = document.createElement('option');
      option.value = layout.id;
      option.textContent = layout.name;
      keyboardLayout.appendChild(option);
    }
    keyboardLayout.value = getLayout(selected) ? selected : 'auto';
    updateDeadKeysRow();
  }

  // Only show the dead key setting for layouts that have dead keys
  function updateDeadKeysRow() {
    const id = keyboardLayout.value === 'auto' ? (detectedLayout || FALLBACK_LAYOUT) : keyboardLayout.value;
    const layout = getLayout(id);
    deadKeysRow.style.display = layout && hasDeadKeys(layout) ? '' : 'none';
  }

  // Load saved preferences
  chrome.storage.local.get(['typingSpeed', 'keyboardLayout', 'deadKeys'], async function(result) {
    // Set the typingSpeed slider to the saved value or the default
    const savedSpeed = result.typingSpeed || 75;
    // Calculate the reversed value for the slider
    typingSpeed.value = reverseValue(savedSpeed);
    speedValue.textContent = savedSpeed + ' ms';

    deadKeys.checked = result.deadKeys !== false;
    fillLayoutList(result.keyboardLayout || 'auto');

    // Detect this computer's layout and remember it, for pages where it can't be detected
    detectedLayout = await detectLayout();
    if (detectedLayout) {
      chrome.storage.local.set({ detectedLayout });
    }
    fillLayoutList(keyboardLayout.value);
  });

  keyboardLayout.addEventListener('change', function() {
    chrome.storage.local.set({ keyboardLayout: this.value });
    updateDeadKeysRow();
  });

  deadKeys.addEventListener('change', function() {
    chrome.storage.local.set({ deadKeys: this.checked });
  });

  // Event listener for the typingSpeed slider
  typingSpeed.addEventListener('input', function() {
    // Calculate the actual value (reversed)
    const actualValue = reverseValue(parseInt(this.value));
    // Update the displayed value while dragging
    speedValue.textContent = actualValue + ' ms';
  });

  typingSpeed.addEventListener('change', async function() {
    // Calculate the actual value (reversed)
    const actualValue = reverseValue(parseInt(this.value));

    // Save the actual value in local storage
    chrome.storage.local.set({ typingSpeed: actualValue });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      // Inject the content script first, in case it isn't there yet
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Then send the message with the actual value
      chrome.tabs.sendMessage(tab.id, {
        action: 'setTypingSpeed',
        speed: actualValue
      });
    } catch (err) {
      console.error('Error running script:', err);
    }
  });
});
