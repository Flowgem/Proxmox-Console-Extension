chrome.commands.onCommand.addListener((command) => {
  if (command === 'paste-clipboard') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && !tabs[0].url.startsWith('chrome://')) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }).then(() => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'keyboard-shortcut'});
          }, 100);
        }).catch(err => {
          console.error('Fout bij uitvoeren script:', err);
        });
      }
    });
  }
});
