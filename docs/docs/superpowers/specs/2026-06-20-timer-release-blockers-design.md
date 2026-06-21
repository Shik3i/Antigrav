# Timer Release Blockers Design

## Ziel

Zwei Release-Blocker im zentralen Timerpfad werden minimal und kompatibel behoben:

1. Ein Snapshot aus einem anderen Raum darf nicht anhand der Revision des bisherigen Raums verworfen werden.
2. Ein Persistenzfehler während eines Timerabschlusses darf keine unbehandelte Promise-Rejection und kein ausbleibendes Socket-Acknowledgement verursachen.

## Verhalten

### Raumwechsel

`isStaleTimerSnapshot(current, incoming)` vergleicht `timerRevision` nur, wenn beide Snapshots denselben Raum über `id` bezeichnen. Bei unterschiedlichen Raum-IDs wird der eingehende Snapshot akzeptiert. Innerhalb desselben Raums bleibt die bestehende Regel erhalten: Nur niedrigere Revisionen werden verworfen; gleiche Revisionen bleiben für Nutzer- und Workspace-Aktualisierungen zulässig.

### Abschluss und Persistenzfehler

Der Timerabschluss ist eine bereits vollzogene In-Memory-Zustandsänderung. Fehler beim anschließenden Speichern von Statistik, TimerEvent oder Coins rollen diesen Zustand nicht zurück. Stattdessen fängt der Lifecycle-Service Persistenzfehler kontrolliert ab und protokolliert sie. Der Socket-Handler kann den erfolgreich ausgeführten Timerbefehl dadurch weiterhin genau einmal bestätigen; es entsteht keine unbehandelte Promise-Rejection.

Ein dauerhafter Retry-/Outbox-Mechanismus ist ausdrücklich nicht Teil dieses Fixes. Das entspricht dem bisherigen Best-Effort-Verhalten und vermeidet eine kurzfristige Änderung des Persistenzmodells.

## Tests

- Selector-Regressionstest: Ein neuer Raum mit Revision `0` wird nach einem bisherigen Raum mit höherer Revision nicht als stale bewertet.
- Lifecycle-Regressionstest: Eine abgelehnte Persistenzoperation wird protokolliert und `handleCompletion` löst nicht nach außen ab.
- Socket-Regressionstest: `END_EARLY` bestätigt den erfolgreichen Timerzustandswechsel auch bei intern behandeltem Persistenzfehler.
- Anschließend vollständige Test-Suite und Produktions-Build.

## Nicht im Scope

- Durable Outbox oder automatische Wiederholungen für fehlgeschlagene Belohnungen
- Änderungen am Coin-, TimerEvent- oder Datenbankschema
- Allgemeine Timer- oder UI-Refactorings
