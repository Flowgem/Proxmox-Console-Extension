document.addEventListener('DOMContentLoaded', function() {
  const typingSpeed = document.getElementById('typingSpeed');
  const speedValue = document.getElementById('speedValue');
  
  // Functie om de waarde om te keren: 10 -> 200, 200 -> 10
  function reverseValue(value) {
    // Bereken de omgekeerde waarde (10 wordt 200, 200 wordt 10)
    return 210 - value;
  }

  // Controleer of dit een update is en toon een update-melding indien nodig
  chrome.storage.local.get(['lastVersion'], function(result) {
    const currentVersion = '1.1';
    const lastVersion = result.lastVersion || '0';
    
    // Als dit een update is van een oudere versie naar 1.1
    if (lastVersion !== currentVersion) {
      // Sla de nieuwe versie op
      chrome.storage.local.set({ lastVersion: currentVersion });
      
      // Als het een update is van 1.0 (niet een nieuwe installatie)
      if (lastVersion === '1.0') {
        // Toon update-melding
        showUpdateNotification();
      }
    }
  });
  
  // Functie om update-melding te tonen
  function showUpdateNotification() {
    // Maak een overlay element
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
    
    // Maak een melding element
    const notification = document.createElement('div');
    notification.style.backgroundColor = 'white';
    notification.style.borderRadius = '8px';
    notification.style.padding = '20px';
    notification.style.maxWidth = '80%';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    
    // Inhoud van de melding
    notification.innerHTML = `
      <h3 style="color: #2E7D32; margin-top: 0;">Bijgewerkt naar versie 1.1!</h3>
      <p>Wat is er nieuw:</p>
      <ul style="padding-left: 20px; margin-bottom: 15px;">
        <li><strong>Nieuwe naam:</strong> Van "Proxmox Console Extension" naar "VM Console Extension"</li>
        <li>Verbeterde gebruikersinterface</li>
        <li>Vereenvoudigde bediening</li>
        <li>Intuïtievere slider voor invoersnelheid</li>
        <li>Vernieuwd logo en icoon</li>
      </ul>
      <button id="closeUpdateNotification" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; float: right;">Sluiten</button>
      <div style="clear: both;"></div>
    `;
    
    // Voeg de melding toe aan de overlay
    overlay.appendChild(notification);
    
    // Voeg de overlay toe aan de body
    document.body.appendChild(overlay);
    
    // Sluit de melding wanneer op de knop wordt geklikt
    document.getElementById('closeUpdateNotification').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
  }

  // Laad opgeslagen voorkeuren
  chrome.storage.local.get(['typingSpeed'], function(result) {
    // Stel de typingSpeed slider in op de opgeslagen waarde of de standaardwaarde
    const savedSpeed = result.typingSpeed || 75;
    // Bereken de omgekeerde waarde voor de slider
    typingSpeed.value = reverseValue(savedSpeed);
    speedValue.textContent = savedSpeed + ' ms';
  });
  
  // Event listener voor de typingSpeed slider
  typingSpeed.addEventListener('input', function() {
    // Bereken de echte waarde (omgekeerd)
    const actualValue = reverseValue(parseInt(this.value));
    // Update de weergegeven waarde tijdens het slepen
    speedValue.textContent = actualValue + ' ms';
  });
  
  typingSpeed.addEventListener('change', async function() {
    // Bereken de echte waarde (omgekeerd)
    const actualValue = reverseValue(parseInt(this.value));
    
    // Sla de echte waarde op in de lokale opslag
    chrome.storage.local.set({ typingSpeed: actualValue });
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      // Injecteer eerst de content script als deze nog niet bestaat
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Stuur dan pas het bericht met de echte waarde
      chrome.tabs.sendMessage(tab.id, { 
        action: 'setTypingSpeed', 
        speed: actualValue 
      });
    } catch (err) {
      console.error('Fout bij uitvoeren script:', err);
    }
  });
}); 