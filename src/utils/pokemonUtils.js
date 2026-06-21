/**
 * Centralized logic for selecting the next Pokémon based on theme configurations.
 * Handles brightness filters and type-based selection.
 */
export const getNextPokemon = (pokemonList, themeConfig) => {
    if (!Array.isArray(pokemonList) || pokemonList.length === 0) return null;

    const brightnessFilter = themeConfig?.brightnessFilter || 'all';
    const mode = themeConfig?.mode || 'random';
    const selectedType = themeConfig?.selectedType;

    let available = pokemonList;
    if (mode === 'type' && selectedType) {
        available = available.filter(p => p.types.includes(selectedType));
    }

    const filteredByBrightness = available.filter(p => {
        if (brightnessFilter === 'light') return p.threshold > 0.6;
        if (brightnessFilter === 'dark') return p.threshold <= 0.6;
        return true;
    });

    // Fallback: If brightness filter results in 0, use the type-filtered list
    const finalPool = filteredByBrightness.length > 0 ? filteredByBrightness : available;
    
    if (finalPool.length === 0) return null;
    
    return finalPool[Math.floor(Math.random() * finalPool.length)];
};
