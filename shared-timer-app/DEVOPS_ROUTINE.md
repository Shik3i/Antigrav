# Antigravity DevOps Routine (V1)

Dieses Dokument ist eine strikte Arbeitsanweisung für den Agenten bei jedem Feature-Abschluss oder Release. Wenn der User "Führe DEVOPS_ROUTINE aus" befiehlt, müssen folgende Schritte exakt in dieser Reihenfolge abgearbeitet werden:

### 1. Versions-Update
- Öffne `Settings.jsx`.
- Suche die Versionsnummer (z.B. "Version 2.9.0").
- Erhöhe die Minor-Version um +1 (z.B. von 2.9.0 auf 2.10.0).
- Speichere die Datei.

### 2. Changelog-Dokumentation
- Öffne die Datei, die für den Changelog zuständig ist (z.B. `Changelog.jsx` oder die entsprechende JSON/Daten-Datei).
- Erstelle einen neuen Eintrag ganz oben.
- Fasse die Änderungen des aktuellen Tasks kurz und präzise zusammen.
- Nutze das aktuelle Datum.

### 3. Git-Synchronisation (STRIKTE EINZELBEFEHLE)
Führe die Git-Befehle nacheinander aus. Nutze NIEMALS `&&` Verknüpfungen. Warte auf den Erfolg jedes Befehls:
1. `git add .`
2. `git commit -m "Release v[VERSION]: [Zusammenfassung]"`
3. `git pull`
4. `git push`

---
*Hinweis: Diese Routine stellt sicher, dass der Code-Stand, die UI-Anzeige und das Repository immer synchron sind.*
