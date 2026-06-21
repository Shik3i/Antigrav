# 🐨 Antigravity Room & Casino

Antigrav ist eine Echtzeit-Webanwendung mit sozialem Fokus. Das Projekt kombiniert synchronisierte Räume, Fortschritts- und Belohnungssysteme, Browser-Games, Countdowns, Wettbewerbe sowie datengetriebene Bereiche wie Esports, Märkte und API-Integrationen in einer gemeinsamen Plattform.

---

## ✨ Überblick

Die Anwendung besteht aus:

- **React + Vite** im Frontend
- **Node.js + Express** im Backend
- **Socket.io** für Echtzeitfunktionen
- **SQLite** als persistente Datenbank

Antigrav ist damit deutlich mehr als nur ein geteilter Timer oder ein kleines Casino-Modul. Die Plattform bündelt mehrere soziale, spielerische und datenbasierte Features in einer Anwendung.

---

## 🧩 Hauptfunktionen

### 🏠 Räume und Echtzeitfunktionen
- synchronisierte Räume mit gemeinsamem State
- Echtzeit-Updates über Socket.io
- geteilte Timer- und Countdown-Funktionen
- soziale Interaktionen in Lobby- und Raumkontexten

### 👤 Nutzerkonto und Social Features
- Registrierung und Login
- Profile und Einstellungen
- Freundesfunktionen
- Achievements und Fortschrittssysteme
- Highscores und Leaderboards
- Admin-Bereich für Verwaltung und Monitoring

### 🎮 Spiele und interaktive Module
- Speedcube Timer
- Wordle
- Tower Climb
- Lotto
- Scratchcards / Scratchcard Shop
- Rift Defense
- Koala Flap
- Color Sync
- Tetris
- LoL Idle / Road to Worlds

### 📊 Daten- und Eventbereiche
- Esports-Ansichten
- Polymarket- / Marktbereiche
- globale Wetten / Betting-Funktionen
- Changelog
- Feature Requests
- gemeinsame Countdowns

### 🔌 Erweiterbarkeit
- REST-API über Express
- externe Integrationen, z. B. Twitch oder Odds API

---

## 🛠️ Tech-Stack

### Frontend
- React
- Vite
- React Router
- Recharts
- Lucide React

### Backend
- Node.js
- Express
- Socket.io
- SQLite
- JSON Web Tokens

### Infrastruktur
- Docker / Docker Compose
- Umgebungsvariablen für Konfiguration und externe APIs

---

## 🗂️ Projektstruktur

```text
Antigrav-main/
├── README.md
    ├── src/                # React-Frontend
    ├── controllers/        # API- und Business-Logik
    ├── routes/             # Express-Routen
    ├── sockets/            # Socket.io-Handler
    ├── services/           # Externe Dienste / Integrationen
    ├── cron/               # Hintergrundjobs
    ├── public/             # Öffentliche Assets
    ├── config/
    ├── utils/
    ├── server.js           # Express- und Socket-Server
    ├── database.js         # SQLite-Anbindung
    ├── restart_server.sh   # Neustart-Skript Linux/macOS
    ├── restart_server.bat  # Neustart-Skript Windows
    ├── package.json
    └── docker-compose.yml
```

---

## 🚀 Lokales Setup

### Voraussetzungen
- Node.js
- npm
- optional: Docker und Docker Compose

### Installation

```bash
npm install
```

### Entwicklung starten

```bash
npm run dev
```

Hinweis: `npm run dev` startet die Vite-Entwicklungsumgebung für das Frontend.

### Produktionsbuild erstellen

```bash
npm run build
```

### Anwendung im Produktionsmodus starten

```bash
npm start
```

Standardmäßig läuft der Server auf Port `3001`, sofern kein anderer Port per Umgebungsvariable gesetzt wird.

---

## ⚙️ Konfiguration per Umgebungsvariablen

Im Projekt werden aktuell unter anderem diese Variablen verwendet:

- `PORT` – Port des Backends
- `DB_PATH` – Pfad zur SQLite-Datenbank
- `JWT_SECRET` – Secret für Token / Authentifizierung
- `ADMIN_PASSWORD` – Passwort für Admin-Funktionen
- `THE_ODDS_API_KEY` – API-Key für Odds-/Betting-Daten
- `TWITCH_CLIENT_ID` – Twitch Client ID
- `TWITCH_CLIENT_SECRET` – Twitch Client Secret

Beispiel:

```env
PORT=3001
DB_PATH=./data/timer.db
JWT_SECRET=change-me
ADMIN_PASSWORD=change-me
THE_ODDS_API_KEY=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
```

---

## 🐳 Docker

Im Root-Verzeichnis liegt eine `docker-compose.yml` für den Containerbetrieb.

Typischer Ablauf:

```bash
cd .
docker compose up --build
```

Wichtig:
- das Datenverzeichnis wird als Volume eingebunden
- die SQLite-Datenbank kann so persistent gespeichert werden
- produktive Secrets und API-Keys sollten **nicht fest in Compose-Dateien** gepflegt werden


---

## 🔁 DevOps-Routine im Alltag

Für kleine und größere Änderungen ist eine einfache DevOps-Routine sinnvoll, damit der Stand im Projekt sauber bleibt.

Empfohlener Ablauf:

1. **Git-Status prüfen**
2. **Änderungen sinnvoll zusammenfassen**
3. **Build / Funktion kurz prüfen**
4. **sauber committen**
5. **pushen oder PR erstellen**

Typische Befehle:

```bash
git status
git diff --stat
git add .
git commit -m "feat: describe your change"
git push
```

Warum das hilfreich ist:

- kleine Änderungen bleiben nachvollziehbar
- Fehlerquellen werden früher sichtbar
- Commits und PRs werden für andere Entwickler leichter prüfbar
- Refactorings, Hotfixes und Feature-Arbeit lassen sich sauber trennen

Gerade in einem Projekt mit mehreren Modulen, Echtzeitlogik, API-Routen und Frontend-Komponenten lohnt sich diese Routine auch bei kleineren Anpassungen.

---

## 🔄 Nutzung von `restart_server.sh` und `restart_server.bat`

Im Projekt liegen zwei Hilfsskripte für den Neustart im produktionsnahen lokalen Betrieb:

- `restart_server.sh` für **Linux / macOS**
- `restart_server.bat` für **Windows**

### Was die Skripte tun

#### `restart_server.sh`
- wechselt in das Projektverzeichnis
- beendet einen laufenden Prozess auf dem konfigurierten Port
- erstellt den Frontend-Build neu
- startet anschließend den Server

Aufruf:

```bash
./restart_server.sh
```

Optional mit anderem Port:

```bash
PORT=3001 ./restart_server.sh
```

#### `restart_server.bat`
- beendet laufende `node.exe`-Prozesse
- baut das Frontend neu
- startet den Server erneut

Aufruf unter Windows:

```bat
restart_server.bat
```

### Wann die Skripte sinnvoll sind

Diese Skripte sind nützlich, wenn du:

- nach Änderungen schnell einen frischen Produktionsstart brauchst
- lokal ohne Prozessmanager testest
- Build + Start mit einem Schritt ausführen willst

### Wichtiger Hinweis

`restart_server.bat` beendet aktuell **alle** laufenden `node.exe`-Prozesse. Das ist praktisch, kann aber problematisch sein, wenn auf dem System noch andere Node-Anwendungen laufen.

Für lokale Entwicklung mit Hot Reload bleibt meist weiterhin besser geeignet:

```bash
npm run dev
```

---

## 🌐 API und Echtzeit

- REST-Endpunkte laufen unter `/api`
- Echtzeitkommunikation wird über Socket.io umgesetzt
- das Backend übernimmt zusätzlich Cronjobs und Hintergrundverarbeitung

---

## 📝 Dokumentationsstatus

Diese README beschreibt das Projekt auf Basis der aktuellen Struktur deutlich passender als die frühere Timer-/Casino-Beschreibung. Für ein späteres Feintuning wären zusätzlich sinnvoll:

- genaue Startanleitung für den kombinierten Frontend-/Backend-Workflow
- Beschreibung der wichtigsten API-Endpunkte
- Dokumentation der Admin-Funktionen
- `.env.example` für einfacheres Setup

## 🆕 Update-Hinweis für Version 3.0.0

### Für Entwickler (Source-Code Installation)

**Wichtig für bestehende lokale Installationen:**

Mit Version 3.0.0 wurde die Projektstruktur vereinfacht:
- Der `shared-timer-app/` Wrapper-Ordner wurde entfernt
- Alle Dateien liegen nun direkt im Repository-Root
- Docker-Context ist jetzt `.` statt `./shared-timer-app`
- Alle Befehle werden direkt aus dem Root-Verzeichnis ausgeführt

**Migration von bestehenden lokalen Installationen:**
1. Stoppen Sie den laufenden Server
2. Sichern Sie Ihre `data/` und `.env` Dateien
3. Aktualisieren Sie auf die neue Version
4. Führen Sie `npm install` im Root-Verzeichnis aus
5. Starten Sie den Server mit `npm start`

Die Konfiguration und Funktionalität bleiben unverändert - nur die Verzeichnisstruktur wurde vereinfacht.

### Für Docker-Nutzer

**Keine manuelle Migration nötig!**

Für Docker-Nutzer ist der Update-Prozess einfach:
- Watchtower aktualisiert automatisch, wenn der neue Tag `v3.0.0` veröffentlicht wird
- Bei manueller Aktualisierung: `docker compose pull` und `docker compose up -d`
- Die Datenbank und Konfiguration im `./data` Volume bleiben unverändert
- Die App-Struktur im Container war bereits korrekt unter `/app` (nicht `/app/shared-timer-app`)

**Keine Änderungen an Ihrer Docker-Konfiguration nötig!**

---

## 📄 Lizenz

Derzeit ist im Projekt keine weiter ausgearbeitete öffentliche Projektdokumentation zur Lizenz enthalten. Falls das Projekt geteilt oder veröffentlicht wird, sollte die Lizenz explizit ergänzt werden.
