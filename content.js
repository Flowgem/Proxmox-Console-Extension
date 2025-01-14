if (typeof autoModeEnabled === 'undefined') {
  var autoModeEnabled = false;
}
if (typeof lastFocusedElement === 'undefined') {
  var lastFocusedElement = null;
}
if (typeof messageHandler === 'undefined') {
  var messageHandler = (request, sender, sendResponse) => {
    if (request.action === 'paste') {
      handlePaste();
    } else if (request.action === 'setAutoMode') {
      autoModeEnabled = request.enabled;
    }
  };
}
if (typeof shortcutHandler === 'undefined') {
  var shortcutHandler = (request, sender, sendResponse) => {
    if (request.action === 'keyboard-shortcut') {
      handlePaste();
    }
  };
}

// Functie om tekst als toetsaanslagen te simuleren
async function simulateKeystrokes(text) {
  const chars = text.split('');
  
  const targetElement = lastFocusedElement || document.activeElement;
  
  // Voeg een kleine initiële vertraging toe
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check of we in een VM console zitten
  const isVMConsole = window.location.href.includes('spice') || 
                      window.location.href.includes('vnc') || 
                      document.querySelector('canvas#screen') ||
                      document.querySelector('div.console-container');
  
  // Helper functie om de juiste key code en shift status te bepalen
  function getKeyInfo(char) {
    const specialChars = {
      '!': { key: '1', shift: true },
      '@': { key: '2', shift: true },
      '#': { key: '3', shift: true },
      '$': { key: '4', shift: true },
      '%': { key: '5', shift: true },
      '^': { key: '6', shift: true },
      '&': { key: '7', shift: true },
      '*': { key: '8', shift: true },
      '(': { key: '9', shift: true },
      ')': { key: '0', shift: true },
      '_': { key: '-', shift: true },
      '+': { key: '=', shift: true },
      '{': { key: '[', shift: true },
      '}': { key: ']', shift: true },
      '|': { key: '\\', shift: true },
      ':': { key: ';', shift: true },
      '"': { key: "'", shift: true },
      '<': { key: ',', shift: true },
      '>': { key: '.', shift: true },
      '?': { key: '/', shift: true },
      '~': { key: '`', shift: true }
    };
    
    if (specialChars[char]) {
      return {
        key: specialChars[char].key,
        code: 'Key' + specialChars[char].key.toUpperCase(),
        shift: true
      };
    }
    
    return {
      key: char,
      code: 'Key' + char.toUpperCase(),
      shift: char.match(/[A-Z]/) ? true : false
    };
  }
  
  // Gebruik for...of in plaats van forEach voor async/await
  for (const char of chars) {
    if (isVMConsole) {
      // Wacht kort voordat we beginnen met het volgende karakter
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const charCode = char.charCodeAt(0);
      const keyInfo = getKeyInfo(char);
      
      // Definieer canvas eerst
      const canvas = document.querySelector('canvas#screen') || targetElement;
      
      if (keyInfo.shift) {
        const shiftDownEvent = new KeyboardEvent('keydown', {
          key: 'Shift',
          code: 'ShiftLeft',
          keyCode: 16,
          which: 16,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          shiftKey: true
        });
        canvas.dispatchEvent(shiftDownEvent);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Keydown event
      const downEvent = new KeyboardEvent('keydown', {
        key: keyInfo.key,
        code: keyInfo.code,
        keyCode: charCode,
        which: charCode,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        shiftKey: keyInfo.shift
      });
      
      // Keypress event
      const pressEvent = new KeyboardEvent('keypress', {
        key: keyInfo.key,
        code: keyInfo.code,
        keyCode: charCode,
        which: charCode,
        charCode: charCode,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        shiftKey: keyInfo.shift
      });
      
      // Keyup event
      const upEvent = new KeyboardEvent('keyup', {
        key: keyInfo.key,
        code: keyInfo.code,
        keyCode: charCode,
        which: charCode,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        shiftKey: keyInfo.shift
      });
      
      canvas.dispatchEvent(downEvent);
      await new Promise(resolve => setTimeout(resolve, 15));
      canvas.dispatchEvent(pressEvent);
      await new Promise(resolve => setTimeout(resolve, 15));
      canvas.dispatchEvent(upEvent);
      
      if (keyInfo.shift) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const shiftUpEvent = new KeyboardEvent('keyup', {
          key: 'Shift',
          code: 'ShiftLeft',
          keyCode: 16,
          which: 16,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          shiftKey: false
        });
        canvas.dispatchEvent(shiftUpEvent);
      }
      
      // Langere vertraging tussen karakters voor Edge
      await new Promise(resolve => setTimeout(resolve, 75));
    } else {
      // Wacht kort voordat we beginnen met het volgende karakter
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Normale input velden
      if (!targetElement || !targetElement.isContentEditable && !['INPUT', 'TEXTAREA'].includes(targetElement.tagName)) {
        console.error('Geen geldig invoerveld geselecteerd');
        return;
      }
      
      // Bestaande code voor normale input velden
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
      
      // Simuleer input event
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true
      });
      targetElement.dispatchEvent(inputEvent);
      
      // Simuleer keyup
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
      
      // Voor input en textarea elementen, update direct de waarde
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        const start = targetElement.selectionStart;
        const end = targetElement.selectionEnd;
        const currentValue = targetElement.value;
        targetElement.value = currentValue.substring(0, start) + char + currentValue.substring(end);
        targetElement.setSelectionRange(start + 1, start + 1);
      }
    }
  }
}

// Verwijder bestaande listeners (als ze bestaan) en voeg nieuwe toe
if (chrome.runtime.onMessage.hasListeners()) {
  chrome.runtime.onMessage.removeListener(messageHandler);
  chrome.runtime.onMessage.removeListener(shortcutHandler);
}
chrome.runtime.onMessage.addListener(messageHandler);
chrome.runtime.onMessage.addListener(shortcutHandler);

// Functie om plakactie af te handelen
async function handlePaste() {
  try {
    // Probeer eerst navigator.clipboard
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (clipboardErr) {
      // Fallback naar execCommand als navigator.clipboard faalt
      const tempInput = document.createElement('textarea');
      document.body.appendChild(tempInput);
      tempInput.focus();
      document.execCommand('paste');
      text = tempInput.value;
      document.body.removeChild(tempInput);
    }
    
    if (text) {
      simulateKeystrokes(text);
    } else {
      throw new Error('Geen tekst gevonden in klembord');
    }
  } catch (err) {
    console.error('Fout bij plakken:', err.message);
  }
}

// Sla het laatst gefocuste element op
document.addEventListener('focusin', (event) => {
  lastFocusedElement = event.target;
});

// Event listener voor automatisch plakken
if (autoModeEnabled) {
  document.addEventListener('focus', (event) => {
    if (event.target.matches('textarea, input[type="text"]')) {
      handlePaste();
    }
  }, true);
} 