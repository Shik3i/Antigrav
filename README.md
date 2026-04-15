# 🐨 Antigravity Room & Casino

Eine Echtzeit-Webanwendung für kollaborative Fokus-Sitzungen, kombiniert mit sozialen Minigames und einem Belohnungssystem.

## 🚀 Features

### ⏱️ Room Timer & Management
- **Synchronisierte Timer:** Alle Nutzer im Raum sehen denselben Countdown.
- **Admin-Controls:** Raum-Admins können den Timer starten, pausieren oder vorzeitig beenden.
- **Intelligenter Notaus:** Beim vorzeitigen Beenden werden Belohnungen (KoalaCoins) anteilig basierend auf der abgelaufenen Zeit ausgeschüttet.
- **Auto-Restart:** Optionale Funktion für automatische Fokus-Zyklen.

### 🎮 Social Minigames (PvP)
- **Visual Coinflip:** Ein synchronisierter 3D-Münzwurf für alle Nutzer im Raum mit Echtzeit-Ergebnisanzeige.
- **Interactive Deathroll:** Ein Würfel-Duell-System mit abnehmendem Max-Wert, bis jemand die "1" würfelt.
- **Echtzeit-Updates:** Alle Interaktionen werden via WebSockets ohne Verzögerung an alle Raummitglieder übertragen.

### 💰 Economy System
- **KoalaCoins (KC):** Belohnungssystem für absolvierte Zeit im Timer.
- **Leveling:** Fortschrittssystem basierend auf der Aktivität in den Räumen.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Lucide-React (Icons), CSS3 Animations
- **Backend:** Node.js, Express
- **Echtzeit:** Socket.io (WebSockets)
- **Datenbank:** SQLite / JSON-Store (je nach Konfiguration)

## 📦 Installation & Start

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
