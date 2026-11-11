# VM Console Extension  

🚀 **Easily Paste into Your VM Console Sessions!** 🚀  

Managing virtual machines in VM environments can be frustrating when you can't copy and paste directly into the console. The **VM Console Extension** solves this issue by allowing you to paste text, commands, or configurations directly into your console sessions.  

---

## 🌟 Features  
- **Clipboard Integration:** Directly paste clipboard content into VM web console sessions.  
- **Seamless Workflow:** Avoid switching between tools—just copy and paste!  
- **Time-Saving Tool:** Reduce repetitive typing and avoid errors with simple pasting.  
- **Easy to Use:** Intuitive interface with quick activation from your browser toolbar.  
- **Adjustable Speed:** Control the typing speed to match your VM console's responsiveness.
- **Keyboard Layouts:** Works with VMs that use other keyboard layouts than English (US), such as German, French, Czech or Norwegian.

---

## ⌨️ Keyboard Layouts
VM consoles like noVNC send the *physical key* to the VM, and the VM's own keyboard layout decides which character it becomes. That's why the extension needs to know which layout the VM uses: on a German VM, the key that types `y` on a US keyboard types `z`.

- **Automatic** (default) uses the layout of the computer you're on. This works when the VM uses the same layout as your computer.
- If the VM uses a different layout, pick it in the extension's popup.
- **The VM uses dead keys:** many layouts type `^ ~ \`` with dead keys (they wait for the next key). Turn this off if the VM uses a "no dead keys" variant.

The layouts come from [xkeyboard-config](https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config), the layout database used by Linux. `layout-data.js` is generated with `tools/generate-layouts.mjs`; see the top of that file for how to run it or add a layout.

---

## 📋 Changelog

### Version 1.2
- **Keyboard Layouts:** 34 keyboard layouts, detected automatically from your computer. Characters like `y z / _ - @ ~` now come out right in VMs that don't use English (US)
- **Accented Characters:** Characters like `é ü ñ` are typed with dead keys on layouts that have them
- **Line Breaks:** New lines are sent as Enter and tabs as Tab
- **Languages:** The extension is available in English, Dutch and Norwegian

### Version 1.1
- **Name Change:** Renamed from "Proxmox Console Extension" to "VM Console Extension" for broader applicability
- **UI Improvements:** Completely redesigned interface with a modern look and feel
- **Simplified Controls:** Removed unnecessary buttons and options for a cleaner experience
- **Intuitive Speed Control:** Redesigned slider with more logical orientation (left = slow, right = fast)
- **Visual Refresh:** Updated logo and icon design
- **Performance Improvements:** Optimized code for better reliability

### Version 1.0
- Initial release

---

## 🚀 Installation  
### Option 1: Download from Chrome Web Store  
The easiest way to install the extension is via the Chrome Web Store:  

[![Chrome Web Store](https://developer.chrome.com/static/docs/webstore/branding/image/YT2Grfi9vEBa2wAPzhWa.png)](https://chromewebstore.google.com/detail/proxmox-console-extension/mnkdipbaleabnmdhikbhnkennhldlmaf)  

Click the logo above or use this link: [**VM Console Extension** on Chrome Web Store](https://chromewebstore.google.com/detail/proxmox-console-extension/mnkdipbaleabnmdhikbhnkennhldlmaf)


### Option 2: Manual Installation 
1. Clone or download the repository:  
   ```bash
   git clone https://github.com/Flowgem/proxmox-console-extension.git
2. Open your browser and navigate to the **Extensions** page:  
   - **Chrome:** `chrome://extensions`  
   - **Edge:** `edge://extensions`  
3. Enable **Developer Mode** (usually a toggle in the top right).  
4. Click **Load Unpacked** and select the folder where you cloned this repository.  
5. The extension is now installed and ready to use! 🎉  
6. **Set up a Shortcut:**  
   - Go to the **Extensions** page.  
   - Click on the **Keyboard Shortcuts** option (usually at the bottom of the page).  
   - Assign a custom shortcut to activate the VM Console Extension.  
   - Now you can quickly trigger the extension with your chosen key combination! ⌨️  
  

---

## 🛠️ Usage  
1. Open your VM web interface and navigate to the console of a virtual machine.  
2. Copy the desired text or command to your clipboard.  
3. Use the keyboard shortcut:  
   - **Chrome:** The default shortcut is `Ctrl + M` (Windows/Linux) or `Command + M` (Mac).  
   - **Edge:** You must manually set a shortcut:  
     - Go to the **Extensions** page (`edge://extensions`).  
     - Click on **Keyboard Shortcuts** at the bottom of the page.  
     - Assign a custom shortcut for the VM Console Extension.  
4. The clipboard content will be pasted into the active console session as keyboard input. 🚀  


---

## 📖 Permissions  
The extension requires the following permissions to function:  
- **Clipboard Access:** To read the clipboard content.  
- **Active Tab Access:** To interact with the VM console session.  

---

## 🛡️ Security Notice  
Your clipboard content is processed locally and is never sent to any external server. Your data privacy is our top priority. 🔒  

---

## 💡 Contributing  
Contributions are welcome! If you have ideas, bug fixes, or improvements, feel free to fork the repository and submit a pull request.  

---

## 📧 Support  
For issues or questions, feel free to create a [GitHub Issue](https://github.com/yourusername/proxmox-console-extension/issues) or reach out via email.  

---
## ☕ Support Me  
If you find this extension helpful and want to support its development, you can buy me a coffee! Your support is greatly appreciated. 💖  

[![Buy Me a Coffee](https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-1.svg)](https://buymeacoffee.com/flowgem)  

