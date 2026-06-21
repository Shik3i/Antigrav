# V3 Upgrade Safety Design

## Ziel

Die P1- und P2-Findings aus dem Review von `v3.0.0` werden so behoben, dass bestehende Installationen ihre Daten und Konfiguration behalten, lokale Starts eine inkompatible Node-Version klar ablehnen und Docker-Installationen über GHCR aktualisiert werden können.

## Daten- und Konfigurationsmigration

Ein idempotentes Node-Skript `scripts/migrate-v3-layout.js` migriert vor dem Serverstart verbliebene Laufzeitdaten aus `shared-timer-app/` ins Repository-Root. Es verschiebt `.env`, wenn am Ziel keine `.env` existiert. Für `data/` verschiebt es einzelne Einträge und überspringt vorhandene Ziele, damit keine aktuelle Datenbank oder Konfiguration überschrieben wird. Leere Legacy-Verzeichnisse dürfen anschließend entfernt werden; Konflikte werden verständlich gemeldet und bleiben am alten Ort erhalten.

Das Skript exportiert seine Migrationsfunktion für echte Dateisystemtests und läuft über `prestart` automatisch vor `npm start`. Es verwendet ausschließlich Node-Kernmodule.

## Node-Version

`scripts/require-node-24.js` prüft den Major-Release und beendet Installations- und Startvorgänge außerhalb von Node 24 mit einer klaren Fehlermeldung. `preinstall` und `prestart` verwenden diese Prüfung. README und Upgrade-Anleitung nennen Node 24 sowie `.nvmrc`.

## Docker-Distribution

Der Compose-Service erhält `image: ghcr.io/shik3i/antigrav:latest` zusätzlich zu `build: .`. Damit funktionieren `docker compose pull`, Watchtower und weiterhin lokale Builds mit `docker compose build`. Die Dokumentation unterscheidet Registry-Update und lokalen Build.

Vor dem ersten v3-Compose-Start muss bei einem Repository-basierten Altbetrieb das Host-Verzeichnis `shared-timer-app/data` mittels Migrationsskript nach `data` übernommen werden. Ein Container kann einen nicht eingebundenen alten Host-Pfad nicht selbst zuverlässig migrieren.

## Verifikation

Automatisierte Tests prüfen konfliktfreie und konflikthafte Migration, Idempotenz, Node-Version-Prüfung, Compose-Image und Dokumentation. Danach laufen vollständige Tests, Produktionsbuild und Dependency-Audit.
