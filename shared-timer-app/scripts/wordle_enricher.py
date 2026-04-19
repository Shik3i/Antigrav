import json
import os
import time
import requests
import sys
import re

# --- CONFIGURATION ---
BASE_URL = "http://localhost:1234/api/v1"
MODEL = "google/gemma-4-e4b"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "wordle_dictionary_export.json")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "wordle_enriched_import.json")

# --- TEST MODE: Setze auf None um alle Wörter zu verarbeiten ---
TEST_LIMIT = None

# ============================================================
# PROMPT ENGINEERING
# ============================================================
# Klare Rolle + strikte JSON-only Anweisung.
# Kleine Modelle wie Gemma 4B brauchen sehr explizite Anweisungen.
SYSTEM_PROMPT = """Du bist ein präziser JSON-Generator für ein deutsches Wordle-Spiel.

DEINE AUFGABE:
- Schreibe eine DEFINITION im Stil eines knappen Lexikoneintrags (Duden-Stil).
  Format: "[Wortart]. [Kernbedeutung in einem klaren Satz, ggf. Verwendungsbeispiel oder Kontext]"
  Beispiel für TISCH: "Substantiv. Möbelstück mit ebener Platte auf Beinen, an dem man sitzt, arbeitet oder isst."
  
- Schreibe einen LUSTIGEN SPRUCH (funny_quote) der das Wort verwendet.
  Regeln für guten Humor:
  * Nutze Wortspiele, Doppeldeutigkeiten oder absurde Logik
  * Trocken-ironischer Ton, wie im deutschen Kabarett
  * Das Wort muss natürlich im Satz vorkommen
  * Kurz und prägnant (max. 20 Wörter)
  * NIEMALS Meta-Kommentare über das Spiel oder das Wort selbst

GUTE BEISPIELE (lerne von diesen):
Wort APFEL:
{
  "word": "APFEL",
  "definition": "Substantiv. Rundes Kernobst mit süß-säuerlichem Geschmack; weltweit angebaute Kulturpflanze der Gattung Malus.",
  "funny_quote": "Ein Apfel am Tag hält den Arzt fern – aber wer hält den Arzt fern, wenn man den Apfel im Dunkeln isst?"
}

Wort STUHL:
{
  "word": "STUHL",
  "definition": "Substantiv. Sitzmöbel mit Rückenlehne für eine Person; auch medizinisch für Darmausscheidung verwendet.",
  "funny_quote": "Beim Stuhlgang denken die wenigsten ans Sitzmöbel – und beim Stuhl die wenigsten an den Gang."
}

Wort GLÜCK:
{
  "word": "GLÜCK",
  "definition": "Substantiv. Gefühl tiefer Zufriedenheit und Freude; auch günstiger Zufall oder unverhoffter Erfolg.",
  "funny_quote": "Glück ist, wenn die Ampel grün wird, kurz bevor man bremsen müsste – und man es dem Auto hinter sich anmerkt."
}

AUSGABE-REGELN:
- Antworte AUSSCHLIESSLICH mit einem einzigen gültigen JSON-Objekt
- Kein Text davor oder danach
- Keine Markdown-Codeblöcke (kein ```json)
- Keine Erklärungen oder Kommentare"""


def get_user_prompt(word: str) -> str:
    """Erstellt den User-Prompt für ein spezifisches Wort."""
    return f"""Erstelle jetzt Definition und funny_quote für dieses Wort:

Wort: {word} (5 Buchstaben, deutsches Substantiv/Verb/Adjektiv)

Antworte NUR mit diesem JSON-Format:
{{
  "word": "{word}",
  "definition": "...",
  "funny_quote": "..."
}}"""


# ============================================================
# JSON EXTRACTION (robust gegen LLM-Halluzinationen)
# ============================================================

def extract_json(text: str) -> str:
    """Extrahiert JSON aus LLM-Ausgabe, auch wenn Preamble oder Markdown vorhanden."""
    # Markdown Code-Blöcke entfernen
    text = re.sub(r'```(?:json)?\s*', '', text)
    text = text.replace('```', '').strip()

    # Erstes vollständiges JSON-Objekt per Klammer-Matching finden
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                return text[start:i + 1]
    return text


# ============================================================
# API CALL
# ============================================================

def enrich_word(word: str) -> dict | None:
    """Ruft LM Studio API auf und gibt angereicherte Wort-Daten zurück."""
    try:
        payload = {
            "model": MODEL,
            "system_prompt": SYSTEM_PROMPT,
            "input": get_user_prompt(word)
        }

        response = requests.post(
            f"{BASE_URL}/chat",
            json=payload,
            timeout=90  # Großzügiger Timeout für lokale Modelle
        )

        if response.status_code != 200:
            print(f"  [Error] Server antwortete mit {response.status_code}: {response.text[:200]}")
            return None

        result = response.json()

        # Response-Format auflösen (LM Studio Custom / OpenAI-kompatibel)
        content = ""
        if 'output' in result and isinstance(result['output'], list):
            for part in result['output']:
                if part.get('type') == 'message':
                    content = part.get('content', '')
                    break
        elif 'content' in result:
            content = result['content']
        elif 'choices' in result:
            content = result['choices'][0]['message']['content']
        else:
            print(f"  [Error] Unbekanntes Response-Format: {list(result.keys())}")
            return None

        content = content.strip()

        if not content:
            print(f"  [Error] Leere Antwort vom Modell für '{word}'")
            return None

        # Debug-Ausgabe der Rohantwort (hilfreich beim Testen)
        print(f"  [Debug] Rohausgabe: {content[:300]}")

        json_str = extract_json(content)
        parsed = json.loads(json_str)

        # Pflichtfelder prüfen
        required_keys = ["word", "definition", "funny_quote"]
        missing = [k for k in required_keys if k not in parsed]
        if missing:
            print(f"  [Warning] Fehlende Felder {missing} für '{word}'. Überspringe.")
            return None

        # Qualitätsprüfung: Abfangen wenn Modell Meta-Kommentare produziert
        quote = str(parsed["funny_quote"]).strip()
        bad_patterns = ["wordle", "dieses wort", "das wort", "5 buchstaben", "im spiel"]
        if any(p in quote.lower() for p in bad_patterns):
            print(f"  [Warning] funny_quote enthält Meta-Kommentar, wird trotzdem gespeichert: '{quote}'")

        return {
            "word": word.upper(),
            "definition": str(parsed["definition"]).strip(),
            "funny_quote": quote
        }

    except json.JSONDecodeError as e:
        print(f"  [Error] JSON-Parsing fehlgeschlagen für '{word}': {e}")
        print(f"  [Debug] Problematischer String: {json_str[:200] if 'json_str' in dir() else 'N/A'}")
        return None
    except Exception as e:
        print(f"  [Error] Unerwarteter Fehler bei '{word}': {e}")
        return None


# ============================================================
# MAIN
# ============================================================

def main():
    mode_label = f"TEST (nur {TEST_LIMIT} Wort)" if TEST_LIMIT else "VOLLSTÄNDIG (alle Wörter)"
    print(f"=== Wordle AI Dictionary Enricher === Modus: {mode_label}")

    if not os.path.exists(INPUT_FILE):
        print(f"Fehler: {INPUT_FILE} nicht gefunden.")
        print("Bitte zuerst den Export aus dem Admin-Panel herunterladen.")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Fehler: {INPUT_FILE} ist kein gültiges JSON.")
            return

    if not isinstance(data, list):
        print("Fehler: Input-JSON muss eine Liste von Wort-Objekten sein.")
        return

    # Bereits verarbeitete Wörter laden (Resume-Funktion)
    enriched_data = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                enriched_data = json.load(f)
                print(f"Resume: {len(enriched_data)} bereits verarbeitete Einträge geladen.")
        except Exception:
            print("Konnte Output-Datei nicht laden, starte neu.")

    processed_words = {entry['word'].upper() for entry in enriched_data}

    to_process = [
        item for item in data
        if item['word'].upper() not in processed_words
        and (not item.get('definition') or not item.get('funny_quote'))
    ]

    if TEST_LIMIT:
        to_process = to_process[:TEST_LIMIT]

    total = len(to_process)
    print(f"Zu verarbeiten: {total} Wörter (von {len(data)} gesamt)\n")

    if total == 0:
        print("Nichts zu tun – alle Wörter haben bereits Metadaten.")
        return

    success_count = 0
    skip_count = 0

    try:
        for i, item in enumerate(to_process):
            word = item['word'].upper()
            print(f"[{i + 1}/{total}] Verarbeite: {word} ...")

            result = enrich_word(word)

            if result:
                enriched_data.append(result)
                success_count += 1
                # Zwischenspeichern nach jedem Wort
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(enriched_data, f, indent=2, ensure_ascii=False)
                print(f"  [OK] definition: {result['definition'][:60]}...")
                print(f"  [OK] funny_quote: {result['funny_quote']}")
            else:
                skip_count += 1
                print(f"  [Skip] Fehler bei {word}")

            if i < total - 1:
                time.sleep(0.5)

    except KeyboardInterrupt:
        print(f"\nUnterbrochen. Fortschritt gespeichert in: {OUTPUT_FILE}")
        sys.exit(0)

    print(f"\n{'=' * 50}")
    print(f"Fertig! Erfolgreich: {success_count} | Übersprungen: {skip_count}")
    print(f"Output: {OUTPUT_FILE}")
    if TEST_LIMIT:
        print("\n>>> TEST erfolgreich? Setze TEST_LIMIT = None für den vollen Durchlauf! <<<")
    else:
        print("Nächster Schritt: Admin-Panel → Bulk Import Metadata → JSON einfügen.")


if __name__ == "__main__":
    main()
