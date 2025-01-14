document.addEventListener('DOMContentLoaded', function() {
  const pasteButton = document.getElementById('pasteButton');
  const autoMode = document.getElementById('autoMode');

  // Laad opgeslagen voorkeuren
  chrome.storage.local.get(['autoMode'], function(result) {
    autoMode.checked = result.autoMode || false;
  });

  pasteButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      // Injecteer eerst de content script als deze nog niet bestaat
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Stuur dan pas het bericht
      chrome.tabs.sendMessage(tab.id, { action: 'paste' });
    } catch (err) {
      console.error('Fout bij uitvoeren script:', err);
    }
  });

  autoMode.addEventListener('change', async function() {
    chrome.storage.local.set({ autoMode: this.checked });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      // Injecteer eerst de content script als deze nog niet bestaat
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Stuur dan pas het bericht
      chrome.tabs.sendMessage(tab.id, { 
        action: 'setAutoMode', 
        enabled: this.checked 
      });
    } catch (err) {
      console.error('Fout bij uitvoeren script:', err);
    }
  });
}); 