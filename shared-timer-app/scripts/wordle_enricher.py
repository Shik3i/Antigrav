import json
import os
import time
import requests
import sys

# --- CONFIGURATION ---
# LM Studio Local API (ensure LM Studio is running and the server is started)
BASE_URL = "http://localhost:1234/v1"
MODEL = "gemma"  # Model name doesn't usually matter for LM Studio local server

# Path configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "wordle_dictionary_export.json")  # Put your export here
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "wordle_enriched_import.json")   # Results will be here

def enrich_word(word):
    """
    Calls local LM Studio API to generate definition and funny quote in German.
    """
    prompt = f"""Du bist ein hilfreicher Assistent für das Spiel Wordle. 
Erstelle für das Wort '{word}' eine kurze, knackige Definition und einen lustigen, kurzen Spruch (funny quote) auf DEUTSCH.
Das Wort hat 5 Buchstaben.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt in folgendem Format:
{{
  "word": "{word}",
  "definition": "Hier die kurze Definition...",
  "funny_quote": "Hier der lustige Spruch..."
}}"""

    try:
        response = requests.post(
            f"{BASE_URL}/chat/completions",
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": "Du bist ein JSON-Generator für Spiel-Metadaten. Antworte nur in validem JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            },
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content'].strip()
        
        # Clean up potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"  [Error] Failed to enrich '{word}': {e}")
        return None

def main():
    print("=== Wordle AI Dictionary Enricher (LM Studio Edition) ===")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found. Please download it from the Admin Panel first.")
        print("Expected format: Array of objects with 'word' key.")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Error: {INPUT_FILE} is not a valid JSON file.")
            return

    if not isinstance(data, list):
        print("Error: Input JSON must be a list of word objects.")
        return

    enriched_data = []
    
    # Load already enriched data if exists to resume
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                enriched_data = json.load(f)
                print(f"Resuming: Loaded {len(enriched_data)} already enriched entries.")
        except:
            pass

    processed_words = {entry['word'] for entry in enriched_data}
    
    # Filter for words that need enrichment
    # We enrich words that haven't been processed yet AND don't have both fields filled
    to_process = [item for item in data if item['word'] not in processed_words and (not item.get('definition') or not item.get('funny_quote'))]
    
    # TEST MODE: Only process the first word
    to_process = to_process[:1]
    print(f"Found {len(data)} words in export. TEST MODE: Processing only the first required word.")
    
    if not to_process:
        print("Nothing to process. All words already have metadata.")
        return

    try:
        for i, item in enumerate(to_process):
            word = item['word']
            print(f"[{i+1}/{len(to_process)}] Processing: {word}...")
            
            result = enrich_word(word)
            if result:
                enriched_data.append(result)
                # Intermediate save
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(enriched_data, f, indent=2, ensure_ascii=False)
                print(f"  [Success] Saved metadata for {word}")
            else:
                print(f"  [Skip] Error processing {word}")
            
            # Small delay to prevent overwhelming the local LLM
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nStopping... Progress saved to", OUTPUT_FILE)
        sys.exit(0)

    print(f"\nDone! Enriched data saved to {OUTPUT_FILE}")
    print("Next step: Open the Admin Panel, copy the content of this file, and paste it into 'Bulk Import Metadata'.")

if __name__ == "__main__":
    main()
