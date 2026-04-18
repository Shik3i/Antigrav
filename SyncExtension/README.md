# 🔌 SyncExtension

A lightweight Chrome extension for **browser-based media sync** with the Antigrav room.

It connects three layers:

- 🎛️ the **extension popup**
- 🌉 the **room bridge** on `timer.shik3i.net` or `localhost:3001`
- 🎬 the **selected browser tab** that contains a playable video

The extension is **not** a standalone sync platform.  
It is a helper layer for the broader **Antigrav** project.

---

## ✨ Purpose

SyncExtension allows a user inside an Antigrav room to:

- choose a browser tab as the sync target
- send **Play / Pause** commands to that tab
- run a **Force Sync** flow
- share tab readiness and playback status with the room
- inspect diagnostics and development logs during testing

---

## ✅ What matches the current codebase

This README was checked against the current files in `SyncExtension/`.

### Confirmed behaviors

- ✅ **Manifest V3** extension
- ✅ **Popup-based controls**
- ✅ **Background service worker**
- ✅ **Bridge script** for the Antigrav room page
- ✅ **Dynamic content script injection** into the selected media tab
- ✅ **Play / Pause controls**
- ✅ **Two-step Force Sync**
- ✅ **Room peer tracking**
- ✅ **History view**
- ✅ **Developer diagnostics**
- ✅ **Optional browser notifications**
- ✅ **Bridge mode switch** for production vs localhost
- ✅ **Badge state** when a target tab is active
- ✅ **Heartbeat / cleanup logic**
- ✅ **Playback state cache**
- ✅ **Noise filtering for tab selection**

---

## 🧱 Project structure

```text
SyncExtension/
├── manifest.json
├── background.js
├── bridge.js
├── content.js
├── popup.html
├── popup.js
└── icons/
    └── icon128.png
```

### File overview

#### `manifest.json`
Defines:

- Manifest V3 setup
- permissions
- host permissions
- popup entry
- service worker
- bridge content script for the room URLs

#### `background.js`
The central coordinator.

It handles:

- runtime messages
- room broadcasts
- peer tracking
- heartbeat processing
- badge updates
- cleanup of stale peers
- force-sync state handling
- optional notifications
- proactive `content.js` injection after target-tab changes

#### `bridge.js`
Runs only on the Antigrav room URLs:

- `https://timer.shik3i.net/*`
- `http://localhost:3001/*`

It bridges communication between:

- the room page via `window.postMessage`
- the extension background worker via `chrome.runtime.sendMessage`

It also respects the selected **bridge environment mode**.

#### `content.js`
Injected into the selected media tab.

It handles:

- media commands
- video detection
- playback confirmation
- force-sync pause/seek/play flow
- native video event reporting
- special handling for YouTube and Twitch
- heartbeat messages when a real video exists

#### `popup.html` / `popup.js`
The popup UI and popup logic.

The popup currently contains these areas:

- 🎮 Controls
- 🕘 History
- 🧪 Dev
- 📜 Logs
- ⚙️ Settings

---

## 🧩 Requirements

You need:

- a Chromium-based browser with Manifest V3 support
- the Antigrav room open on one of these URLs:
  - `https://timer.shik3i.net/...`
  - `http://localhost:3001/...`
- a browser tab with a playable media element, usually an HTML5 `<video>`

---

## 🔐 Permissions

### Extension permissions

The current manifest uses:

- `tabs`
- `storage`
- `scripting`
- `alarms`
- `notifications`

### Host permissions

The current manifest uses:

- `<all_urls>`
- `https://timer.shik3i.net/*`

### Important note

The extension does **not** inject `content.js` everywhere automatically.

Actual behavior is more precise:

- `bridge.js` is loaded only on the Antigrav room URLs
- `content.js` is injected **on demand** into the selected target tab via `chrome.scripting.executeScript(...)`

So the host permission scope is broad, but the actual runtime behavior is narrower than “always active on all sites”.

---

## 🚀 Installation

### Load as unpacked extension

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `SyncExtension` folder

After that, the extension popup is available from the toolbar.

---

## 🎮 How to use

### 1. Open the Antigrav room
Open either:

- **Production:** `https://timer.shik3i.net/...`
- **Local development:** `http://localhost:3001/...`

### 2. Open the extension popup
The popup checks your open tabs and also tries to detect whether a room tab is available.

If a room tab is open, the popup status changes from **Disconnected** to **Timer detected**.

### 3. Select the target tab
Choose the tab that should receive media sync commands.

Important design rule from the code:

- ⭐ matching tabs may be highlighted
- 🚫 the extension must **not** auto-switch the selected target tab
- 👆 the user chooses the target tab manually

### 4. Use the controls
Available popup controls include:

- ▶️ Play
- ⏸ Pause
- ⏱ Force Sync

---

## ⏱ Force Sync behavior

The current implementation is a **two-phase** sync flow.

### Phase 1
`force_sync_pause_seek`

The target tab:

- pauses playback
- seeks to the requested timestamp
- waits until the seek is ready / buffered

### Phase 2
`force_sync_play`

The target tab:

- resumes playback
- returns an ACK-like status after verification

This is more accurate than a simple “jump and play” description.

---

## 👥 Peer and room behavior

The extension tracks room peers in local storage.

Confirmed behaviors include:

- storing peer presence/status
- pruning inactive peers after a timeout
- showing room peer information in the popup
- displaying latest activity and ACK information
- sending version announcements between peers

This means the extension is not only a local media remote.  
It also participates in lightweight room-level sync state sharing.

---

## 🧠 Playback handling details

### Playback state cache
`background.js` keeps an in-memory playback state cache so heartbeat messages without playback state do not overwrite the last known status.

### Status throttling
Status announcements are throttled to reduce noise.

### Target tab lifecycle
If the selected target tab is closed:

- the target is cleared
- the badge is updated
- a fresh status announcement is triggered

### Badge state
If a target tab is selected, the extension badge shows:

- `ON`

---

## 🎬 Supported media behavior

The extension is mainly built around HTML5 video control.

### Explicitly visible in the current code

- generic HTML5 `<video>` handling
- YouTube-specific play/pause handling
- Twitch-specific play/pause handling

### Practical implication
It should work best on pages where:

- a normal video element exists
- the page allows scripted media control
- autoplay/browser interaction restrictions do not block playback

If autoplay is blocked, the code already logs a warning that the page may need one manual click first.

---

## 🧪 Popup areas

### 🎮 Controls
Contains:

- target tab selector
- play / pause buttons
- force sync button
- connection state
- room peers
- latest sync activity

### 🕘 History
Shows recent commands.

### 🧪 Dev
Contains:

- diagnostics refresh
- peer discovery / force announce
- bridge environment selector
- developer mode toggle

### 📜 Logs
Available when Developer Mode is enabled.

Current behavior:

- stores the last **50** log entries
- supports **copy**
- supports **clear**
- supports **refresh**

### ⚙️ Settings
Contains:

- **Clean Tab List**  
  hides common mail, messenger, work, and timer tabs from the selection list

- **Remote Notifications**  
  enables or disables browser notifications for peer actions

---

## 🌍 Bridge environment mode

The popup allows switching between:

- **Production**
- **Localhost**

This affects which room tabs are considered valid by the background worker and whether `bridge.js` stays active for the current page.

### Production mode
Targets:

- `*://timer.shik3i.net/*`
- `*://*.timer.shik3i.net/*`

### Localhost mode
Targets:

- `http://localhost:3001/*`

---

## 🔔 Notifications

Notifications are optional and controlled in popup settings.

When enabled, the extension can show browser notifications for peer actions such as:

- play
- pause
- force sync started
- force sync completed

The user-facing notification text is currently partly localized in German.

---

## 🛠️ Local development notes

For local testing:

1. run the Antigrav room on `http://localhost:3001/`
2. switch the popup bridge environment to **localhost**
3. open a target tab with a usable video
4. choose that tab manually in the popup

If sync does not work, check these first:

- the room tab is actually open
- the correct target tab is selected
- the page contains a video element
- `content.js` could be injected successfully
- autoplay restrictions are not blocking playback
- developer logs do not show runtime or messaging errors

---

## ⚠️ Security and maintenance notes

A few practical notes after checking the implementation:

### Broad host permissions
`<all_urls>` is currently used.  
That is convenient for development and dynamic target-tab injection, but broader than ideal for long-term hardening.

### Origin checks exist
`bridge.js` restricts accepted page messages to:

- `https://timer.shik3i.net`
- `http://localhost:3001`

That is good and should stay strict.

### Manual target selection is intentional
The code explicitly avoids automatic target switching.  
That is a good safety and UX decision and should remain documented.

### Version alignment matters
Because the extension exchanges sync and status payloads with the room, extension changes and room changes should stay aligned during active development.

---

## 🔄 Version

Current manifest version in this checked project snapshot:

- **2.9.3**

---

## 📝 Suggested future improvements

Based on the current implementation, these would be sensible future steps:

- narrow host permissions where possible
- document the message protocol between room and extension
- improve user-facing error messages when no video is found
- add release notes per extension version
- document compatibility expectations with the room frontend
- optionally support a clearer allowlist model for supported media sites

---

## 🤝 Summary

SyncExtension is currently best described as:

> a Chrome Manifest V3 helper extension for Antigrav that bridges room-based sync events to a manually selected media tab, supports play/pause and two-step force sync, and provides popup diagnostics, history, peer awareness, and optional notifications.

