import json
import os
import time
import requests

# Configuration
BASE_URL = "http://localhost:1234/v1"
MODEL = "local-model" # LM Studio usually ignores this or uses the loaded one
WORD_LIST_PATH = os.path.join(os.path.dirname(__file__), '..', 'WordleWordList.json')
METADATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'wordle_metadata.json')

def enrich_word(word):
    prompt = f"""Provide a short definition and a funny, short quote for the word: '{word}'.
The definition should be concise. The quote should be witty or humorous.
Respond ONLY with a JSON object in this format:
{{
  "definition": "A short definition here",
  "funny_quote": "A funny quote here"
}}"""

    try:
        response = requests.post(
            f"{BASE_URL}/chat/completions",
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that provides word definitions and funny quotes in JSON format."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            },
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # Try to parse the JSON from content (handling potential markdown blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"Error enriching word '{word}': {e}")
        return None

def main():
    if not os.path.exists(WORD_LIST_PATH):
        print(f"Error: {WORD_LIST_PATH} not found.")
        return

    with open(WORD_LIST_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        words = [w.strip().toUpperCase() if hasattr(w, 'toUpperCase') else w.strip().upper() for w in data.get('data', [])]
        words = list(set([w for w in words if len(w) == 5]))

    # Load existing metadata
    metadata = {}
    if os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                print(f"Loaded existing metadata for {len(metadata)} words.")
        except:
            print("Starting with fresh metadata file.")

    count = 0
    total = len(words)
    
    print(f"Processing {total} words...")

    for word in words:
        if word in metadata:
            continue

        print(f"[{count+len(metadata)}/{total}] Enriching: {word}")
        enriched = enrich_word(word)
        
        if enriched:
            metadata[word] = enriched
            # Atomic-ish save
            with open(METADATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            count += 1
            time.sleep(1.5)
        else:
            print(f"Skipping {word} due to error.")
            time.sleep(2)

    print(f"Done! Enriched {count} new words. Total metadata: {len(metadata)} words.")

if __name__ == "__main__":
    main()
