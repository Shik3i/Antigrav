/**
 * Shared utility for selecting a random Pokémon based on user preferences.
 * Implements the "Smart Filters" (Brightness Limit) and Type-based selection.
 */
export const selectNextPokemon = (pokemonList, themePrefs) => {
    if (!Array.isArray(pokemonList) || pokemonList.length === 0) return null;

    const filter = themePrefs?.brightnessFilter || 'all';
    const mode = themePrefs?.mode || 'random';
    const selectedType = themePrefs?.selectedType;

    // 1. Filter by TYPE if mode is 'type'
    let available = pokemonList;
    if (mode === 'type' && selectedType) {
        available = available.filter(p => p.types.includes(selectedType));
    }

    // 2. Filter by BRIGHTNESS
    const filteredByBrightness = available.filter(p => {
        if (filter === 'light') return p.threshold > 0.6;
        if (filter === 'dark') return p.threshold <= 0.6;
        return true;
    });

    // 3. Select random
    // Fallback: If brightness filter results in 0, use the type-filtered list (or entire list if mode isn't type)
    const finalPool = filteredByBrightness.length > 0 ? filteredByBrightness : available;
    
    if (finalPool.length === 0) return null;
    
    return finalPool[Math.floor(Math.random() * finalPool.length)];
};
