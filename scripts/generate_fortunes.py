import json
import math
import os
import sys
import time
import threading
import requests
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- CONFIGURATION ---
BASE_URL = "http://localhost:1234/v1"
MODEL    = "google/gemma-4-e4b"

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "fortunes_metadata.json")
STATE_FILE  = os.path.join(SCRIPT_DIR, "fortunes_state.json")

# Maximale Gesamtversuche pro Lauf — verhindert Endlosschleife
# wenn LM Studio hängt oder jedes Keyword dauerhaft leer bleibt.
MAX_ATTEMPTS_MULTIPLIER = 6   # count_to_generate * 4 = harter Deckel

# Nach wie vielen Fehlschlägen in Folge ein Keyword übersprungen wird
MAX_CONSECUTIVE_FAILURES = 5

# Längenfilter — muss mit Prompt übereinstimmen
MIN_WORDS = 4
MAX_WORDS = 30  # Prompt sagt "Maximal 25 Wörter" → hier dasselbe

# Parallelität: wie viele Requests gleichzeitig an LM Studio geschickt werden.
# Muss mit n_parallel in den LM Studio Einstellungen übereinstimmen.
MAX_WORKERS = 1

# ============================================================
# KATEGORIEN
# Jede Kategorie hat:
#   - anchors:  4 Beispiele die den Stil zeigen (Few-Shot)
#   - negative: 2 Gegenbeispiele die zeigen was NICHT gewünscht ist
#   - keywords: Themen/Stichwörter die Gemma als Inspiration
#               bekommt — eines pro Request, rotierend
#
# Kapazität: 5 Kategorien × ~40 Keywords = 200 Slots bei
# USES_PER_KEYWORD=1. Wird dynamisch auf Basis von
# count_to_generate berechnet.
# ============================================================

CATEGORIES = [
    {
        "name": "Fake-Horoskop",
        "anchors": [
            # Dreisatz-Eskalation
            "Merkur ist rückläufig. Das bedeutet nichts. Merkur ist immer irgendwie rückläufig.",
            "Die Sterne stehen heute außergewöhnlich günstig. Die Sterne sagten das gestern auch.",
            "Dein Aszendent warnt vor übereilten Entscheidungen. Dein Aszendent warnt immer. Hör trotzdem nicht hin.",
            # Absurde Konkretheit
            "Das Universum hat dir heute eine Botschaft geschickt. Sie landet im Spam-Ordner.",
            "Saturn tritt in dein siebtes Haus. Er hat nicht geklingelt. Er zieht einfach ein.",
            # Statistik / Selbstwiderlegung
            "Du wirst heute eine wichtige Begegnung machen. Das gilt für etwa drei Milliarden Menschen. Viel Erfolg bei der Eingrenzung.",
            "Die kosmischen Kräfte stehen auf deiner Seite. Die kosmischen Kräfte stehen auf aller Seite. Das Universum ist kein Parteimensch.",
            # Unerwartete Wendung
            "Dein Karma gleicht sich heute aus. Das war überfällig. Dein Karma auch.",
            "Venus verspricht dir romantische Energie. Venus verspricht das jedem. Venus ist nicht diskret.",
        ],
        "negative": [
            "Venus bringt dir heute Glück in der Liebe. — ABGELEHNT: klingt nach echtem Horoskop, kein Twist.",
            "Der Vollmond ist ein guter Zeitpunkt für neue Anfänge. — ABGELEHNT: ernst gemeinte Weisheit ohne Ironie.",
            "Jupiter steht günstig für deine Finanzen. — ABGELEHNT: banal, könnte aus jedem Kalender stammen.",
        ],
        "keywords": [
            "Venus", "Jupiter", "Saturn", "Mondphase", "Sonnenfinsternis", "Komet",
            "Tierkreis", "Widder", "Stier", "Zwillinge", "Krebs", "Löwe", "Jungfrau",
            "Waage", "Skorpion", "Schütze", "Steinbock", "Wassermann", "Fische",
            "Neumond", "Vollmond", "Aszendent", "Horoskop", "Karma", "Aura",
            "Chakra", "Energie", "Schwingung", "Manifestation", "Retrogrades",
            "Konjunktion", "Opposition", "Trigon", "Quadrat", "Sextil",
            "Galaktisches Zentrum", "Plejaden", "Schicksal", "Bestimmung",
            "kosmische Kraft", "Planetenstand", "Sternenkonstellation",
        ]
    },
    {
        "name": "Falsche Lebensweisheit",
        "anchors": [
            # Klassische Umkehrung mit konkretem Twist
            "Der frühe Vogel fängt den Wurm. Der Wurm war auch früh aufgestanden. Es hat ihm nichts gebracht.",
            "Jedes Ende ist ein neuer Anfang. Außer beim letzten Ende.",
            "Aus Fehlern lernt man. Du sammelst also seit Jahren Bildungsmaterial.",
            # Dreisatz-Eskalation
            "Wer nicht wagt, der nicht gewinnt. Wer wagt, verliert meistens. Aber mit Stil.",
            "Vertrauen ist gut. Kontrolle ist besser. Ein Spreadsheet ist am besten.",
            # Absurde Logik
            "Alles hat ein Ende. Nur die Wurst hat zwei. Und auch die wird irgendwann gegessen.",
            "Übung macht den Meister. Der Meister hat auch mal klein angefangen. Und dann jahrzehntelang geübt. Viel Spaß.",
            # Selbstwiderlegung
            "Loslassen ist die größte Stärke. Gesagt von jemandem, der das seit Jahren versucht.",
            "Wer anderen eine Grube gräbt, denkt wenigstens voraus.",
        ],
        "negative": [
            "Das Leben ist kurz. Genieße es. — ABGELEHNT: echter Rat ohne Ironie, kein Twist.",
            "Geduld ist eine Tugend. — ABGELEHNT: echter Spruch, keine Brechung.",
            "Sei einfach du selbst. — ABGELEHNT: reine Ermutigung ohne Gegengewicht.",
        ],
        "keywords": [
            "Geduld", "Ausdauer", "Mut", "Vertrauen", "Hoffnung", "Weisheit",
            "Erfahrung", "Reife", "Stärke", "Schwäche", "Balance", "Harmonie",
            "Wachstum", "Veränderung", "Anpassung", "Beständigkeit", "Flexibilität",
            "Ehrlichkeit", "Loyalität", "Dankbarkeit", "Demut", "Stolz",
            "Neugier", "Kreativität", "Disziplin", "Freiheit", "Verantwortung",
            "Mitgefühl", "Selbstliebe", "Akzeptanz", "Loslassen", "Festhalten",
            "Erfolg", "Scheitern", "Risiko", "Sicherheit", "Komfort",
            "Gewohnheit", "Routine", "Spontanität", "Planung", "Zufall",
        ]
    },
    {
        "name": "Nüchterner Pessimismus",
        "anchors": [
            # Kurze, trockene Einschränkung
            "Die meisten Probleme lösen sich von selbst. Die meisten.",
            "Morgen wird alles besser. Das dachtest du gestern auch.",
            # Statistik-Twist
            "Du bist einzigartig. Das sind statistisch gesehen etwa acht Milliarden andere auch.",
            "Die Chancen stehen gut. Für wen genau, bleibt offen.",
            # Dreisatz-Eskalation
            "Es könnte schlimmer sein. Es wird auch schlimmer sein. Genieße den Moment.",
            "Heute ist ein guter Tag. Relativ gesehen. Im Vergleich zu morgen.",
            # Absurde Konkretheit
            "Alles wird gut. Nicht unbedingt für dich. Aber irgendwo, für irgendjemanden, wahrscheinlich.",
            "Du hast heute schon viel geschafft. Oder du hast es zumindest sehr überzeugend ausgesehen.",
            # Lakonische Beobachtung mit Biss
            "Der Wecker klingelt. Das war keine Bitte.",
            "Regen ist nur Sonnenschein in flüssiger Form. Das ändert nichts daran, dass du jetzt nass bist.",
        ],
        "negative": [
            "Montage sind immer schlimm. — ABGELEHNT: Feststellung ohne Pointe.",
            "Der Regen macht alles grau. — ABGELEHNT: klagt nur, kein Twist.",
            "Deadlines sind stressig. Das ist bekannt. — ABGELEHNT: beobachtet nur, dreht nichts um.",
        ],
        "keywords": [
            "Montag", "Meeting", "Deadline", "E-Mail", "Warteschlange", "Regen",
            "Stau", "Verspätung", "Technik", "Akku", "WLAN", "Passwort",
            "Formular", "Bürokratie", "Steuer", "Rechnung", "Warteschleife",
            "Kundenservice", "Update", "Neustart", "Backup", "Absturz",
            "Wecker", "Schlaf", "Müdigkeit", "Motivation", "Prokrastination",
            "Diät", "Fitnessstudio", "Vorsatz", "Gewohnheit", "Erwartung",
            "Enttäuschung", "Kompromiss", "Durchschnitt", "Normalität",
            "Statistik", "Wahrscheinlichkeit", "Zufall", "Pech", "Glück",
        ]
    },
    {
        "name": "Umgekehrte Motivation",
        "anchors": [
            # Klassische Umkehrung
            "Du schaffst alles, was du dir vornimmst. Nimm dir also weniger vor.",
            "Du kannst alles erreichen. Manche Dinge dauern nur etwas länger als ein Leben.",
            # Statistik
            "Glaub an dich. Acht Milliarden Menschen tun das gleichzeitig. Einer von euch hat recht.",
            "Jeder kann es nach oben schaffen. Oben ist allerdings sehr voll und die Luft ist dünn.",
            # Dreisatz
            "Steh auf und kämpf. Oder sitz. Beides hat historisch ähnliche Erfolgsquoten.",
            "Träume groß. Scheitere groß. Erzähl es als Geschichte auf Dinner-Partys.",
            # Absurde Logik
            "Du bist der Held deiner eigenen Geschichte. Der Held hat in Kapitel drei noch keine Ahnung, was er tut.",
            "Verfolge deine Leidenschaft. Die Leidenschaft übernimmt keine Haftung für die Miete.",
            # Lakonisch
            "Kein Schmerz, kein Gewinn. Viel Schmerz, Arztrechnung.",
            "Scheitern ist keine Option. Es ist eine Erfahrung. Eine sehr häufige.",
        ],
        "negative": [
            "Folge deinem Traum. Er wartet auf dich. — ABGELEHNT: klassischer Motivationsspruch, keine Ironie.",
            "Du hast Potenzial. Nutze es. — ABGELEHNT: direkt motivierend, kein Twist.",
            "Gib niemals auf. — ABGELEHNT: reiner Motivationsspruch, nicht gebrochen.",
        ],
        "keywords": [
            "Traum", "Ziel", "Vision", "Mission", "Leidenschaft", "Berufung",
            "Talent", "Potenzial", "Wachstum", "Entwicklung", "Fortschritt",
            "Durchbruch", "Wendepunkt", "Meilenstein", "Erfolg", "Ruhm",
            "Anerkennung", "Applaus", "Bestätigung", "Selbstverwirklichung",
            "Höchstleistung", "Optimierung", "Produktivität", "Effizienz",
            "Mindset", "Fokus", "Klarheit", "Entschlossenheit", "Willenskraft",
            "Ausdauer", "Resilienz", "Comeback", "Neuanfang", "zweite Chance",
            "Inspiration", "Motivation", "Antrieb", "Energie", "Momentum",
        ]
    },
    {
        "name": "Passive-Aggressive Technik",
        "anchors": [
            # Eigenleben der Technik
            "Dein Drucker weiß genau, dass du es eilig hast. Deshalb reinigt er jetzt erstmal seine Düsen.",
            "Dein Akku ist bei 1%. Er wird genau in dem Moment sterben, in dem du das Ladekabel berührst.",
            "Dein Passwort ist korrekt. Wir sperren dich trotzdem kurz aus. Nur um sicherzugehen.",
            # Personifizierung mit Boshaftigkeit
            "Die Lesebestätigung ist raus. Der Ball liegt jetzt bei ihr. Der Ball liegt schon seit drei Tagen da.",
            "Das Update ist optional. Stand jetzt. In zwei Wochen ist es Pflicht und du wirst keine Wahl haben.",
            "Dein Smart-Home hat heute Morgen selbst entschieden, die Heizung auszuschalten. Es wollte mal Grenzen setzen.",
            # Ironische Sachlichkeit
            "Die Verbindung wurde getrennt. Mitten im Satz. Die Verbindung findet das in Ordnung.",
            "Die Autokorrektur hat heute wieder ein eigenes Wort erfunden. Sie ist kreativ. Leider nicht auf deine Bitte hin.",
            # Eskalation
            "Du hast die Benachrichtigungen deaktiviert. Die App hat das zur Kenntnis genommen. Sie schickt dir jetzt E-Mails.",
            "Der Ladebalken ist bei 99%. Er ist schon seit elf Minuten bei 99%. Er braucht noch einen Moment.",
        ],
        "negative": [
            "Bluetooth macht manchmal Probleme. — ABGELEHNT: sachliche Feststellung, kein Eigenleben, kein Twist.",
            "Updates dauern lange. Das ist nervig. — ABGELEHNT: Beschwerde ohne Wendung.",
            "Das WLAN ist wieder langsam. — ABGELEHNT: bloße Beobachtung, die Technik tut nichts Aktives.",
        ],
        "keywords": [
            "Bluetooth-Koppelung", "Drucker-Tinte", "Cookie-Banner", "Update-Zwang", "Lesebestätigung",
            "Sprachnachricht", "Smart-Home", "Cloud-Speicher", "Passwort-Manager",
            "Zwei-Faktor-Authentifizierung", "Ladebalken", "System-Update", "Benachrichtigungston",
            "Inkognito-Tab", "Suchverlauf", "Autokorrektur", "Caps-Lock",
            "WLAN-Passwort", "Roaming", "Cache", "Cookies", "Datenvolumen", "Hotspot",
            "Flugmodus", "Bildschirmzeit", "Datenschutzeinstellungen", "Nutzungsbedingungen",
        ]
    },
]

# Lookup-Dict für schnellen Zugriff per Name
CATEGORY_MAP = {cat["name"]: cat for cat in CATEGORIES}

# ============================================================
# PROMPTS
# ============================================================

SYSTEM_PROMPT = """Du schreibst witzige deutsche Glückskeks-Sprüche für eine Web-App.

Jeder Spruch braucht eine überraschende Wendung. Diese kann auf verschiedene Arten funktionieren — wähle frei:

• Dreisatz-Eskalation: Satz 1 klingt normal → Satz 2 bestätigt scheinbar → Satz 3 bricht alles zusammen
• Absurde Konkretheit: Eine abstrakte Aussage wird durch ein hyperkonkretes Detail lächerlich gemacht
• Selbstwiderlegung: Der Spruch widerlegt sich im letzten Halbsatz selbst
• Personifizierung: Ein Objekt oder Konzept handelt böswillig mit eigener Agenda
• Statistik-Twist: Eine ermutigende Aussage wird durch eine nüchterne Zahl entwertet
• Lakonische Pointe: Kurze, trockene Einschränkung die alles vorher Gesagte aushöhlt

Stilprinzipien:
- Konkrete Bilder schlagen abstrakte Aussagen. Nicht "es wird schlimmer" sondern "er reinigt jetzt seine Düsen".
- Kürze ist Stärke. Kein Füllwort, keine Erklärung der Pointe.
- Der Ton ist trocken, nicht aufgeregt. Die Ironie ergibt sich, sie wird nicht angekündigt.

Nicht erwünscht: echte Ratschläge, echter Optimismus, reine Beobachtungen ohne Wendung, alles das aus einem Abreißkalender kommen könnte.

Ausgabe: Nur der fertige Spruch. Kein Präambel, keine Anführungszeichen, keine Erklärung."""


def build_user_prompt(category: dict, keyword: str) -> str:
    # Kommentar-Zeilen (# ...) aus den Anchors herausfiltern — nur Sprüche
    clean_anchors = [a for a in category["anchors"] if not a.strip().startswith("#")]
    examples = "\n".join(f'- {e}' for e in clean_anchors)
    negatives = "\n".join(f'- {e}' for e in category.get("negative", []))
    negative_block = (
        f"\nDiese Sprüche wären abgelehnt worden:\n{negatives}\n"
        if negatives else ""
    )
    return f"""Kategorie: "{category['name']}"

Gute Beispiele — verschiedene Mechanismen, alle mit überraschender Wendung:
{examples}
{negative_block}
Schreib jetzt EINEN neuen Spruch in diesem Stil. Wähle selbst welchen Mechanismus du nutzt — Dreisatz-Eskalation, absurde Konkretheit, Selbstwiderlegung, Personifizierung oder lakonische Pointe.
Thematische Inspiration (muss nicht wörtlich vorkommen): "{keyword}"
Maximal {MAX_WORDS} Wörter."""


# ============================================================
# KEYWORD SCHEDULING
# ============================================================

def build_keyword_queue(uses_per_keyword: int) -> list[dict]:
    """
    Erstellt eine Round-Robin-Queue aller Keywords.
    Jedes Keyword kommt genau uses_per_keyword mal vor.
    Kategorien wechseln sich ab damit die Ausgabe abwechslungsreich bleibt.
    """
    pools = {
        cat["name"]: cat["keywords"] * uses_per_keyword
        for cat in CATEGORIES
    }
    cat_names = list(pools.keys())

    iters = {name: iter(pool) for name, pool in pools.items()}
    exhausted = set()
    queue = []

    while len(exhausted) < len(cat_names):
        for name in cat_names:
            if name in exhausted:
                continue
            try:
                keyword = next(iters[name])
                queue.append({"category": name, "keyword": keyword})
            except StopIteration:
                exhausted.add(name)

    return queue


# ============================================================
# STATE — laden, speichern (atomic), zurücksetzen
# ============================================================

def load_state() -> dict:
    """Lädt State aus JSON. Loggt Fehler statt sie still zu schlucken."""
    if not os.path.exists(STATE_FILE):
        return {"queue": [], "position": 0}
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
        if not isinstance(state.get("queue"), list) or not isinstance(state.get("position"), int):
            raise ValueError("Ungültiges State-Format")
        return state
    except Exception as e:
        print(f"  [Warn] State konnte nicht geladen werden ({e}) — starte mit leerem State.")
        return {"queue": [], "position": 0}


def save_state(state: dict):
    """Atomic write: erst in .tmp schreiben, dann umbenennen."""
    tmp = STATE_FILE + ".tmp"
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
    os.replace(tmp, STATE_FILE)


def save_fortunes(fortunes: list):
    """Atomic write für die Ausgabedatei."""
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(fortunes, f, indent=2, ensure_ascii=False)
    os.replace(tmp, OUTPUT_FILE)


def get_or_build_queue(target_count: int) -> tuple[list, int]:
    """
    Gibt aktuelle Queue und Position zurück.
    Berechnet USES_PER_KEYWORD dynamisch aus target_count.
    Erstellt neue Queue wenn keine existiert oder erschöpft.
    """
    state = load_state()
    queue    = state.get("queue", [])
    position = state.get("position", 0)

    total_keywords = sum(len(cat["keywords"]) for cat in CATEGORIES)
    uses_per_keyword = max(1, math.ceil(target_count / total_keywords))

    if not queue or position >= len(queue):
        print(f"  [Queue] Erstelle neue Queue — {target_count} Ziel / {total_keywords} Keywords → {uses_per_keyword}x pro Keyword")
        queue    = build_keyword_queue(uses_per_keyword)
        position = 0
        save_state({"queue": queue, "position": position})
        print(f"  [Queue] {len(queue)} Slots erstellt.\n")

    return queue, position


# ============================================================
# API CALL (mit requests.Session für TCP-Wiederverwendung)
# ============================================================

# Globale Session — wird einmal erstellt und von allen Threads geteilt.
# requests.Session ist thread-safe für get/post.
_session = requests.Session()


def generate_fortune(category_name: str, keyword: str) -> str | None:
    category = CATEGORY_MAP.get(category_name)
    if not category:
        print(f"  [Error] Unbekannte Kategorie: '{category_name}'")
        return None

    try:
        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": build_user_prompt(category, keyword)},
            ],
            "temperature": 0.90,
            "top_p":       0.95,  # etwas mehr Spielraum für unerwartete Wortwahl
            "max_tokens":  850,
        }

        response = _session.post(
            f"{BASE_URL}/chat/completions",
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            print(f"  [Error] HTTP {response.status_code}: {response.text[:200]}")
            return None

        content = response.json()['choices'][0]['message']['content'].strip()
        print(f"  [RAW] {repr(content)}")

        # Bereinigung: Anführungszeichen und Markdown-Reste entfernen
        for ch in ['"', '„', '"', '*']:
            content = content.replace(ch, '')
        content = content.strip()

        # Nur erste Zeile falls Modell mehrere ausgibt
        lines = [l.strip() for l in content.splitlines() if l.strip()]
        content = lines[0] if lines else ""

        # Längenfilter (identisch mit Prompt-Angabe)
        word_count = len(content.split())
        if word_count > MAX_WORDS:
            print(f"  [Skip] Zu lang ({word_count} Wörter)")
            return None
        if word_count < MIN_WORDS:
            print(f"  [Skip] Zu kurz ({word_count} Wörter): {repr(content)}")
            return None

        return content

    except Exception as e:
        print(f"  [Error] API-Fehler: {e}")
        return None


# ============================================================
# MAIN
# ============================================================

def main():
    print("=== KoalaSync Fortune Cookie Generator ===")
    print(f"Output: {OUTPUT_FILE}\n")

    count_to_generate = 10
    if len(sys.argv) > 1:
        try:
            count_to_generate = int(sys.argv[1])
        except ValueError:
            print("Ungültige Zahl — verwende Standard: 10")

    # Bestehende Sprüche laden
    fortunes = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                fortunes = json.load(f)
            print(f"Resume: {len(fortunes)} bestehende Sprüche geladen.")
        except Exception as e:
            print(f"  [Warn] Ausgabedatei nicht lesbar ({e}) — starte neu.")

    # Threading-Primitiven für thread-sichere Zustandsverwaltung
    lock = threading.Lock()

    fortunes_set = set(fortunes)

    # Queue laden oder neu bauen
    queue, position = get_or_build_queue(count_to_generate)
    print(f"Queue-Position: {position}/{len(queue)} ({len(queue) - position} Keywords verbleibend)\n")

    # Alle geteilten Zähler unter einem Lock — kein ungeschützter Zugriff
    state = {
        "success_count":        0,
        "skip_count":           0,
        "duplicate_count":      0,
        "consecutive_failures": 0,
        "total_attempts":       0,
        "position":             position,
        "queue":                queue,
    }
    max_attempts = count_to_generate * MAX_ATTEMPTS_MULTIPLIER

    def process_slot(slot: dict, attempt_label: str) -> tuple[str | None, bool]:
        """Generiert einen Spruch für einen Queue-Slot. Gibt (text, is_duplicate) zurück."""
        cat_name = slot["category"]
        keyword  = slot["keyword"]
        print(f"  [{cat_name}] \"{keyword}\" ({attempt_label})")
        text = generate_fortune(category_name=cat_name, keyword=keyword)
        if text is None:
            return None, False
        with lock:
            is_dup = text in fortunes_set
        return text, is_dup

    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            while True:
                with lock:
                    current_success = state["success_count"]
                    current_attempts = state["total_attempts"]
                    current_position = state["position"]
                    current_queue = state["queue"]

                # Abbruchbedingungen (ohne Lock gelesen, aber nur für Entscheidung ob weiter)
                if current_success >= count_to_generate:
                    break
                if current_attempts >= max_attempts:
                    print(f"\n[Abbruch] Maximale Versuche erreicht ({max_attempts}). "
                          f"LM Studio möglicherweise überlastet oder Modell antwortet nicht.")
                    break

                # Queue erschöpft → neue Runde
                if current_position >= len(current_queue):
                    print("\n[Queue] Alle Keywords verbraucht — starte neue Runde.")
                    total_keywords   = sum(len(cat["keywords"]) for cat in CATEGORIES)
                    uses_per_keyword = max(1, math.ceil(count_to_generate / total_keywords))
                    new_queue = build_keyword_queue(uses_per_keyword)
                    with lock:
                        state["queue"]    = new_queue
                        state["position"] = 0
                    current_queue    = new_queue
                    current_position = 0

                # Batch von MAX_WORKERS Slots bauen — position unter Lock erhöhen
                batch = []
                with lock:
                    while (len(batch) < MAX_WORKERS
                           and state["position"] < len(state["queue"])
                           and state["success_count"] + len(batch) < count_to_generate):
                        batch.append(state["queue"][state["position"]])
                        state["position"] += 1

                if not batch:
                    break

                with lock:
                    state["total_attempts"] += len(batch)
                    consec = state["consecutive_failures"]

                attempt_label = f"Versuch {consec + 1}/{MAX_CONSECUTIVE_FAILURES}"

                with lock:
                    sc = state["success_count"]
                print(f"\n[{sc + 1}/{count_to_generate}] Starte Batch mit {len(batch)} Slot(s)...")

                futures = {
                    executor.submit(process_slot, slot, attempt_label): slot
                    for slot in batch
                }

                for future in as_completed(futures):
                    slot = futures[future]
                    try:
                        text, is_duplicate = future.result()
                    except Exception as e:
                        print(f"  [Error] Thread-Fehler: {e}")
                        text, is_duplicate = None, False

                    with lock:
                        if text and not is_duplicate:
                            fortunes.append(text)
                            fortunes_set.add(text)
                            state["success_count"] += 1
                            state["consecutive_failures"] = 0
                            save_fortunes(fortunes)
                            save_state({"queue": state["queue"], "position": state["position"]})
                            print(f"  [OK] {text}")
                        else:
                            if not text:
                                state["skip_count"] += 1
                                print("  [Skip] Kein verwertbarer Output.")
                            else:
                                state["duplicate_count"] += 1
                                print("  [Skip] Duplikat.")

                            state["consecutive_failures"] += 1
                            if state["consecutive_failures"] >= MAX_CONSECUTIVE_FAILURES:
                                print(f"  [Warn] Keyword \"{slot['keyword']}\" nach {MAX_CONSECUTIVE_FAILURES} "
                                      f"Versuchen übersprungen.")
                                state["consecutive_failures"] = 0
                                save_state({"queue": state["queue"], "position": state["position"]})

                # Minimale Pause zwischen Batches (kein Rate-Limiting nötig bei lokalem LM Studio)
                with lock:
                    sc = state["success_count"]
                if sc < count_to_generate:
                    time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nAbgebrochen. Fortschritt gespeichert.")

    with lock:
        sc  = state["success_count"]
        skp = state["skip_count"]
        dup = state["duplicate_count"]
        att = state["total_attempts"]
        pos = state["position"]
        q   = state["queue"]

    print(f"\n{'=' * 50}")
    print(f"Neu: {sc} | Fehler/Leer: {skp} | Duplikate: {dup} | Versuche gesamt: {att}")
    print(f"Gesamt in Datenbank: {len(fortunes)}")
    print(f"Queue: {pos}/{len(q)} Keywords verbraucht")


if __name__ == "__main__":
    main()
