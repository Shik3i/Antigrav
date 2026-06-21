# Root Flattening and v3 Release Design

## Ziel

KoalaWeb wird von `shared-timer-app/` in das Git-Repository-Root verschoben und anschließend als `v3.0.0` veröffentlicht. Die Migration ändert keine fachliche Modularchitektur und keine Laufzeitlogik; sie vereinheitlicht Pfade, Dokumentation, Tooling und Deployment.

## Zielstruktur

Das Repository-Root wird gleichzeitig App-Root. Verzeichnisse wie `src/`, `controllers/`, `database/`, `tests/`, `public/`, `scripts/` und `docs/` liegen direkt neben `package.json`, `server.js`, `Dockerfile` und `docker-compose.yml`. Der Wrapper-Ordner `shared-timer-app/` entfällt vollständig.

Die bestehenden Backend-Layer und Frontend-Feature-Strukturen bleiben unverändert. Große Dateien, Testgruppierung und fachliche Modulgrenzen werden nicht in diesem Release refaktoriert.

## Kollisions- und Dokumentationsregeln

- Das bestehende Root-README wird mit den präziseren Architekturhinweisen aus `shared-timer-app/README.md` zu einem einzigen Root-`README.md` zusammengeführt.
- `shared-timer-app/docs/superpowers/{plans,specs}` wird mit dem bestehenden Root-`docs/superpowers/{plans,specs}` vereinigt. Es gibt danach nur noch einen Dokumentationsbaum.
- Die App-spezifische `.gitignore` wird mit der Root-`.gitignore` vereinigt. Worktrees, Abhängigkeiten, Builds, Secrets, SQLite-Dateien und lokale Daten bleiben ignoriert.
- App-Leitfäden wie `DEVOPS_ROUTINE.md`, `DEVELOPMENT_GUIDELINES.md` und AI-Kontextdateien bleiben erhalten und liegen nach der Migration im Root beziehungsweise in ihren bisherigen Fachordnern.

## Scratch- und Artefaktbereinigung

- `.playwright-mcp/` und `scripts/__pycache__/` werden aus Git entfernt und dauerhaft ignoriert.
- `scratch/check_wordle_api.js` und `scratch/verify_lotto_v2.js` bleiben als manuelle Diagnosen erhalten und werden nach `scripts/diagnostics/` verschoben.
- `scratch/stress_test_dashboard.js` und `scratch/test_date.js` werden entfernt, weil sie veraltete, kopierte Einmallogik enthalten.
- `scripts/deprecated_deploy_to_unraid.bat` wird entfernt.
- Der Ordner `scratch/` existiert danach nicht mehr.

## Lokale Daten und Build-Artefakte

Vor der Verschiebung wird der laufende Server gestoppt. Das lokale, ignorierte Verzeichnis `shared-timer-app/data/` wird vollständig nach `data/` im Root übernommen, einschließlich Datenbank, Backups, Chip-Skins und JWT-Secret. Die bereitgestellte Datei `backup_2026-06-20_13-30-23.sqlite` bleibt unverändert und unversioniert im Root.

`node_modules/` und `dist/` werden nicht als Quellstruktur migriert. Sie werden im neuen Root aus dem Lockfile beziehungsweise Build neu erzeugt. Das alte `shared-timer-app/` darf nach erfolgreicher Migration keine Dateien mehr enthalten.

## Referenzanpassungen

Alle aktiven Repository-Referenzen werden aktualisiert:

- GitHub Actions baut mit Docker-Kontext `.` statt `./shared-timer-app`.
- README-, DevOps- und Setup-Befehle benötigen kein `cd shared-timer-app` mehr.
- Dokumentationslinks und Strukturdiagramme zeigen die neue Root-Struktur.
- Skripte, Konfigurationen und Tests werden auf verbliebene Wrapper-Pfade geprüft.
- Ein abschließender `rg`-Guard darf außerhalb historischer Migrationsdokumente keine aktive Referenz auf `shared-timer-app` finden.

Relative JavaScript-Imports innerhalb der App bleiben unverändert, weil der komplette Quellbaum gemeinsam verschoben wird.

## Release `v3.0.0`

Die vorbereiteten, nicht veröffentlichten `2.62.0`-Metadaten werden durch `3.0.0` ersetzt. `package.json`, beide Root-Einträge im Lockfile und `src/data/changelog.json` erhalten Version `3.0.0` und das Release-Datum `2026-06-21`. Der Changelog beschreibt Root-Flattening, Node-24-/SQLite-Migration und den zentralen Timer-Refactor.

Nach erfolgreicher Migration wird ein Release-Commit erstellt, `main` gepusht und der annotierte Tag `v3.0.0` gepusht. Der Tag löst den bestehenden GHCR-Workflow aus.

## Verifikation und Freigabegates

Vor dem Tag müssen alle folgenden Gates erfolgreich sein:

1. `npm install` beziehungsweise lockfilegetreue Installation im neuen Root.
2. Vollständige Testsuite unter Node 24.17.0.
3. Produktions-Build im neuen Root.
4. `npm audit --omit=dev` ohne Produktionslücken.
5. Docker-Build mit Kontext `.`.
6. Isolierter Containerstart auf einem Testport mit einer Kopie des Produktionsbackups.
7. HTTP-Smoke-Tests für `/`, `/admin`, `/leveling` und `/api/rooms`.
8. SQLite-Integritäts-, Schreib-/Rollback- und Backup-Lesetest im Container.
9. Keine neuen Server- oder Datenbankfehlerlogs.
10. `git diff --check`, erwarteter Git-Status und Referenz-Guard.

Erst nach diesen Gates dürfen Release-Commit und Tag gepusht werden.

## Rollback

Der ursprüngliche Produktionsbackup bleibt unangetastet. Bei einem fehlgeschlagenen Gate wird kein Tag erstellt. Nach Veröffentlichung kann auf `v2.61.0` beziehungsweise den vorherigen Container-Tag zurückgerollt und das Produktionsbackup wiederhergestellt werden. Externe Unraid-Pfade außerhalb des Repositories müssen beim Deployment auf den neuen Root-Kontext geprüft werden.

## Nicht im Scope

- Aufteilung großer Dateien wie `Admin.jsx`, `socketHandler.js` oder `schema.js`
- Feature-first-Neustrukturierung von Backend oder Tests
- Änderungen an APIs, Datenbankschema oder Anwendungsfunktionen
- Automatische Änderung externer Unraid-Konfigurationen, die nicht im Repository liegen
