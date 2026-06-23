const { addColumn } = require('./utils');

function initializePokemonSchema(database) {
    // PokemonSettings: stores pokemon system settings
    database.exec(`CREATE TABLE IF NOT EXISTS PokemonSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    database.exec(`INSERT OR IGNORE INTO PokemonSettings (key, value) VALUES ('contrast_threshold', '0.6')`);

    // PokemonTypeColors: stores type color mappings
    database.exec(`CREATE TABLE IF NOT EXISTS PokemonTypeColors (
      type_name TEXT PRIMARY KEY,
      hex_color TEXT NOT NULL
    )`);

    // Default type colors
    const defaultColors = [
      ['normal', '#A8A878'], ['fire', '#F08030'], ['water', '#6890F0'], ['grass', '#78C850'],
      ['electric', '#F8D030'], ['ice', '#98D8D8'], ['fighting', '#C03028'], ['poison', '#A040A0'],
      ['ground', '#E0C068'], ['flying', '#A890F0'], ['psychic', '#F85888'], ['bug', '#A8B820'],
      ['rock', '#B8A038'], ['ghost', '#705898'], ['dragon', '#7038F8'], ['dark', '#705848'],
      ['steel', '#B8B8D0'], ['fairy', '#EE99AC']
    ];

    const insertTypeColor = database.prepare(
      'INSERT OR IGNORE INTO PokemonTypeColors (type_name, hex_color) VALUES (?, ?)'
    );
    for (const color of defaultColors) insertTypeColor.run(...color);
}

module.exports = {
    initializePokemonSchema
};