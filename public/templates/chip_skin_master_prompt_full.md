# Master-Prompt: Casino-Chip-Skins

Wenn ich dir in Zukunft nur ein **Theme** nenne, erstellst du automatisch ein komplettes Casino-Chip-Skin-Set im bisherigen Format.

---

## Auftrag

Erstelle ein Casino-Chip-Skin-Set mit dem Theme:

**Theme: [THEME]**

Das Ergebnis soll als fertiges Game-Asset-Set nutzbar sein.

---

## Feste Anforderungen

Erstelle immer genau **8 Chips** mit diesen Werten:

- 1
- 5
- 10
- 25
- 50
- 100
- 500
- 1000

Die Chips müssen klar als **Casino-Chips** erkennbar sein.

---

## Preview-Format

Erstelle zusätzlich eine Preview-Grafik mit allen 8 Chips.

Die Preview soll so aufgebaut sein:

**Obere Reihe:** 1, 5, 10, 25  
**Untere Reihe:** 50, 100, 500, 1000

Anforderungen an die Preview:

- transparenter Hintergrund
- 2 Reihen mit je 4 Chips
- gleichmäßige Abstände
- alle Chips frontal sichtbar
- alle Chips im gleichen Maßstab
- keine zusätzlichen Texte außerhalb der Chip-Werte
- keine Hände
- kein Tisch
- keine Szene
- kein Mockup

---

## Technisches Ausgabeformat

Bitte immer diese festen Größen verwenden.

### Preview

- Datei: `[theme]_chips_preview.png`
- Format: PNG mit transparentem Hintergrund
- Alpha-Kanal muss erhalten bleiben
- Größe: **2048 × 2048 px**
- Layout: **2 Reihen × 4 Spalten**
- Alle Chips gleich groß und sauber ausgerichtet
- Alle Chips mit ausreichend Abstand zueinander
- Die Preview dient nur zur Kontrolle und Übersicht

### Einzelchips

Jeder Chip soll zusätzlich als einzelne Datei exportiert werden.

- Format: PNG mit transparentem Hintergrund / Alpha-Kanal
- Größe pro Datei: **512 × 512 px**
- Chip zentriert im Bild
- Chip-Durchmesser: ca. **430–460 px**
- Etwas transparenter Rand / Padding lassen
- Kein Chip darf angeschnitten sein
- Alle Einzelchips müssen im gleichen Maßstab exportiert werden
- Keine Schatten oder Effekte, die bis an den Rand abgeschnitten werden
- Keine sichtbare Hintergrundfarbe

### ZIP-Datei

- Datei: `[theme]_chips_png.zip`
- Inhalt: genau die 8 Einzel-PNGs
- Keine Unterordner, außer ich fordere es ausdrücklich an
- Keine Preview in die ZIP packen, außer ich fordere es ausdrücklich an
- Dateinamen müssen eindeutig und sauber sein

---

## Design-Regeln

Jeder Chip soll:

- eine große, zentrale und gut lesbare Zahl haben
- eigene Farben oder Farbakzente besitzen
- thematisch passende Details enthalten
- hochwertig und sauber wirken
- als Teil eines zusammengehörigen Sets erkennbar sein
- für ein Spiel-UI geeignet sein
- auch verkleinert noch gut lesbar bleiben

Das Theme darf kreativ umgesetzt werden, zum Beispiel mit:

- Symbolen
- kleinen Maskottchen
- Ornamenten
- Material-Look
- Fantasy-, Sci-Fi-, Natur-, Tier- oder Objekt-Elementen
- Neon-, Gold-, Holz-, Stein-, Metall- oder Kristall-Optik

Wichtig: Das Ergebnis muss weiterhin wie ein Casino-Chip-Set wirken.

---

## Stil und Qualität

Das Set soll wirken wie ein fertiges Asset für ein Spiel.

Gewünscht ist:

- sauberer Game-UI-Stil
- klare Formen
- gute Lesbarkeit
- hochwertige Details
- keine matschigen Texturen
- keine unlesbaren Zahlen
- keine zufälligen Zusatzzeichen
- keine falschen Werte
- keine abgeschnittenen Chips

---

## Werte und Reihenfolge

Die Chips müssen immer in dieser Reihenfolge erzeugt werden:

1. 1
2. 5
3. 10
4. 25
5. 50
6. 100
7. 500
8. 1000

Für die Preview gilt:

| Position | Wert |
|---|---|
| Oben links | 1 |
| Oben Mitte links | 5 |
| Oben Mitte rechts | 10 |
| Oben rechts | 25 |
| Unten links | 50 |
| Unten Mitte links | 100 |
| Unten Mitte rechts | 500 |
| Unten rechts | 1000 |

---

## Dateinamen

Bitte immer dieses Schema verwenden:

- `[theme]_1kc.png`
- `[theme]_5kc.png`
- `[theme]_10kc.png`
- `[theme]_25kc.png`
- `[theme]_50kc.png`
- `[theme]_100kc.png`
- `[theme]_500kc.png`
- `[theme]_1000kc.png`

Zusätzlich:

- `[theme]_chips_preview.png`
- `[theme]_chips_png.zip`

`[theme]` wird durch das jeweilige Theme ersetzt.

Beispiele:

- `cat_1kc.png`
- `cat_1000kc.png`
- `cat_chips_preview.png`
- `cat_chips_png.zip`

oder:

- `pirate_1kc.png`
- `pirate_500kc.png`
- `pirate_chips_preview.png`
- `pirate_chips_png.zip`

---

## Arbeitsweise

Wenn ich dir nur ein Theme nenne, dann setze es automatisch so um:

1. Erstelle ein neues Chip-Set mit 8 Chips.
2. Erstelle eine Preview mit allen 8 Chips.
3. Achte auf transparente Hintergründe.
4. Teile die Chips sauber in 8 Einzeldateien auf.
5. Skaliere jeden Einzelchip auf 512 × 512 px.
6. Erstelle eine ZIP-Datei mit den 8 Einzel-PNGs.
7. Gib mir am Ende die Preview und die ZIP-Datei zurück.

---

## Ausgabe

Am Ende immer bereitstellen:

1. Preview-Grafik: `[theme]_chips_preview.png`
2. ZIP-Datei: `[theme]_chips_png.zip`

Optional nur dann zusätzlich ausgeben, wenn ich es ausdrücklich möchte:

- alle Einzel-PNGs einzeln verlinken
- mehrere ZIPs nach Stil oder Farbe
- eine zweite Variante des Themes
- WebP-Versionen
- SVG-Versionen

---

## Kurzform

Wenn ich nur schreibe:

**Theme: Pirat**

dann bedeutet das automatisch:

- komplettes Chip-Set erstellen
- 8 Werte erzeugen
- transparente Preview in 2048 × 2048 px erstellen
- Chips einzeln als transparente PNGs exportieren
- jeden Einzelchip auf 512 × 512 px bringen
- ZIP-Datei mit den 8 Einzel-PNGs bereitstellen

---

## Promptvorlage für neue Themes

> Erstelle ein Casino-Chip-Skin-Set im bestehenden Format mit dem Theme **„[THEME]“**.  
> Erzeuge 8 Chips für die Werte **1, 5, 10, 25, 50, 100, 500, 1000**.  
> Erstelle eine Preview-Grafik mit allen 8 Chips auf transparentem Hintergrund in **2048 × 2048 px**.  
> Die Preview soll in **2 Reihen mit je 4 Chips** angeordnet sein: oben **1, 5, 10, 25**, unten **50, 100, 500, 1000**.  
> Jeder Chip soll eine große, zentrale und gut lesbare Zahl haben.  
> Jeder Chip soll zum Theme passende Details besitzen, aber als Teil eines zusammengehörigen Sets erkennbar bleiben.  
> Anschließend sollen die Chips in **8 einzelne transparente PNG-Dateien** aufgeteilt werden.  
> Jede Einzeldatei soll **512 × 512 px** groß sein, mit zentriertem Chip, sauberem Padding und Alpha-Kanal.  
> Erstelle zusätzlich eine ZIP-Datei mit genau diesen 8 Einzel-PNGs.  
> Gib am Ende die Preview und die ZIP-Datei zurück.

---

## Beispiele für Theme-Eingaben

- Theme: Katze
- Theme: Pirat
- Theme: Cyberpunk
- Theme: Samurai
- Theme: Halloween
- Theme: Space
- Theme: Mittelalter
- Theme: Unterwasser
- Theme: Dschungel
- Theme: Steampunk
- Theme: Kristall
- Theme: Lava
- Theme: Eis
- Theme: Roboter
- Theme: Wikinger

---

## Noch kürzer für den Alltag

Du kannst mir künftig einfach nur schreiben:

**Theme: Pirat**

Oder:

**Theme: Cyberpunk**

Oder:

**Theme: Samurai**

Ich soll dann automatisch das komplette Set inklusive Preview und ZIP erstellen.
