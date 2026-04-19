# 🔌 SyncExtension v3.0 // Unified Management & Status-Push

SyncExtension is a high-performance Chrome extension (Manifest V3) designed for **real-time media synchronization** across multiple browser instances within an Antigrav room.

It bridges the gap between a web-based coordination room and native HTML5 video elements in arbitrary browser tabs.

---

## 🎯 Purpose & Core Logic
The primary goal is to keep video playback in sync for all participants in a room. Unlike traditional polling-heavy systems, this extension uses a **unidirectional Status-Push model**.

- **Minimizes Network Traffic**: No more constant ping-pong.
- **Reliability**: Direct control over the video's `readyState`.
- **Transparency**: Includes extensive developer logs and diagnostics.

---

## 🛰️ Architecture Overview

The extension consists of four distinct layers:

1.  **🌉 Bridge (`bridge.js`)**: 
    - Runs only on `timer.shik3i.net` or `localhost:3001`.
    - Acts as a translator between the React WebApp (`window.postMessage`) and the Extension Background (`chrome.runtime`).
2.  **🧠 Background Worker (`background.js`)**:
    - The central router. 
    - Manages peer states, handles the 2-minute pruning alarm, and coordinates command routing between the room and the media tab.
3.  **🎬 Content Script (`content.js`)**:
    - Dynamically injected into the target media tab.
    - Directly interacts with `<video>` elements (Play, Pause, Seek).
    - Monitors `readyState` to ensure commands only finish when the video is actually ready.
4.  **🎛️ Popup (`popup.js/html`)**:
    - The management UI for users.
    - Handles tab selection and triggers immediate coordination events.

---

## 🔄 The New Communication Model (v3.0)

### 1. Heartbeats (15s Cycle)
- **Bridge Heartbeat**: Every 15s, the Bridge triggers the Background to broadcast the **full current status** (`tab_status`) to the room. This is the primary discovery mechanism.
- **Content Heartbeat**: Every 15s, the Content Script sends its current playback state and `readyState` to the Background. This **only updates the local cache** and does not generate room traffic. The next Bridge Heartbeat will pick up these cached values.

### 2. Immediate Updates (Reactive)
- **Tab Change**: Choosing a new tab in the popup triggers an **instant** status broadcast.
- **Command Confirmation**: When a `play` or `pause` command is confirmed by the video, the Background resets its cooldown and pushes the new status + ACK to the room immediately.

### 3. Messaging Protocols (Rules for Agents)
- **Internal Responses**: Background and Content scripts use `sendResponse` to confirm local execution (e.g., "Yes, I have successfully paused").
- **External ACKs**: To peers, the extension **never** sends a technical "Response" packet. Instead, it sends **independent ACK messages** within the room's message stream.
- **Unidirectional**: If a peer sends a `tab_status` update, we store it and **do not respond**. Peer discovery happens passively via heartbeats.

---

## ⏱️ Force Sync: Detailed Event Chain

This is the most complex coordination flow in the extension. Here is exactly what happens when **Client A** triggers a Force Sync:

### Phase 1: Preparation (The Handshake)
1.  **Client A (Popup)**: Calculates the target time, sets its local state to `seeking`, and broadcasts `force_sync_pause_seek` to the room.
2.  **Client B (Background)**:
    - Receives the inbound message.
    - **MUST** immediately broadcast an `EXTENSION_SYNC_ACK` to the room (so Client A knows Client B is participating).
    - Tells its local **Content B** to pause and seek.
3.  **Content A & B**: Pause the video, set `currentTime`, and poll until `readyState >= 3` (buffered).
4.  **Ready Signal**: Once buffered, both Backgrounds broadcast a `force_sync_ready` message to the room.

### Phase 2: Execution (The Trigger)
1.  **Client A (Popup)**: Polls local storage. Once it sees that its own tab is ready AND it has received `force_sync_ready` from peers (or reached a timeout), it broadcasts `force_sync_play`.
2.  **Background A & B**: Receive the play command and immediately trigger `video.play()` via their Content Scripts.
3.  **Confirmation**: Both clients are now synchronized. Any slight offset is handled by the initial `seek` precision.

---

## 🛠️ Housekeeping & Technical Notes

### Automated Pruning
A background alarm (`extension-peer-prune`) runs every 2 minutes. It checks the `roomPeers` list and deletes any peer that hasn't sent a status update in more than 60 seconds.

### Injection Logic
Injection is **centralized in the background**. 
- Triggered by `storage.onChanged` for the `targetTabId`.
- Includes a **retry-on-failure** mechanism: if a command fails because the "Receiving end does not exist," the background worker automatically re-injects `content.js` and retries the command.

### Developer Diagnostics
The "Dev" tab in the popup allows for:
- **Force Announce**: Manually triggering a `tab_status` broadcast.
- **Live Logs**: Inspecting the last 50 messaging events.
- **Environment Switch**: Toggle between `Production` and `Localhost` bridge modes.

---

## 🤝 Summary for Future AI Agents
When working on this extension, respect the **unidirectional status push**. Do not re-introduce ping-pong responses for status updates. Focus on maintaining the `background.js` as the single source of truth for peer states and ensure that any new media commands follow the **two-phase coordination** (ACK -> Execution) if multiple peers are involved.
