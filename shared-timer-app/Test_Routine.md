# 🧪 Test- & Entwicklungs-Routine für Agenten

Diese Datei dient als Leitfaden für KI-Agenten, die an diesem Projekt arbeiten, um einen reibungslosen Ablauf und korrekte Verifizierung von Änderungen zu gewährleisten.

## 🚀 Server-Management & Build
Bevor UI-Änderungen oder Änderungen an der Datenbank-Struktur getestet werden, **muss** der Server neu gebaut und gestartet werden.

- **Kommando**: `restart_server.bat`
- **Funktion**: Stoppt laufende Node-Instanzen, führt den Vite-Build für das Frontend aus und startet den Server neu.
- **Wichtig**: Ohne diesen Schritt werden Änderungen im Frontend oft nicht korrekt im Browser reflektiert, da die `dist`-Dateien veraltet sind.

## 🌐 Zugriff & URLs
- **Lokale URL**: `http://localhost:3001`
- **Backend-Port**: `3001`
- **Login-Seite**: `http://localhost:3001/login`

## 🔐 Admin-Zugang (Test-Account)
Für Tests im Admin-Panel oder für Superadmin-Features folgende Zugangsdaten nutzen:

- **Username**: `123`
- **Password**: `123`
- **Features**: Dieser User ist als `is_superadmin = 1` geflaggt und hat Zugriff auf alle geschützten Bereiche sowie den Wartungsmodus-Bypass.

## 📂 Wichtige Komponenten & Schicht-Modell
- **Datenbank**: `database.js` enthält das DB-Layer. Änderungen an Tabellen (z.B. neue Spalten) sollten immer dort mit Migrations-Logik hinterlegt werden.
- **Globaler State**: `src/context/PersistentDataContext.jsx` hält wichtige globale Daten wie Navbar-Settings, Lotto-Infos und Esports-Daten.
- **Routing**: `src/App.jsx` enthält die zentrale Routen-Konfiguration und den `MaintenanceGuard`.
- **Admin-Panel**: `src/pages/Admin.jsx` verwaltet Navigationseinstellungen, Achievements und System-Konfigurationen.

## 🛠️ Wartungsmodus (Maintenance Mode)
- **Status**: Gesteuert über `Admin -> Navigation Settings -> Sidebar Settings`.
- **Verhalten**: Gesperrte Seiten zeigen normalen Usern den `MaintenanceScreen.jsx`. Admins sehen den Content + einen gelben Warn-Banner am oberen Rand.
- **Matching**: Der Guard arbeitet mit robustem Pfad-Matching. Neue Seiten sollten immer in der `NavbarSettings`-Tabelle registriert sein.

## 📜 DevOps Routine
Folge bei jedem Release oder größeren Update der `DEVOPS_ROUTINE.md`.
- Version inkrementieren in `package.json`.
- Changelog aktualisieren.
- Git Commit mit aussagekräftiger Nachricht.

---
*Anmerkung: Bitte pflege dieses Dokument weiter, wenn neue kritische Workflows oder Test-Anforderungen hinzukommen.*
