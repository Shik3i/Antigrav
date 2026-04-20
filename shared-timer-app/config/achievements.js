// Achievement chains configuration
// Each chain is an ordered sequence of milestones.
// The backend dynamically computes rewardCoins = koala_points_per_hour * achievement_reward_multiplier.
// 'statKey' tells the controller which DB function to use for progress.

const ACHIEVEMENTS_CONFIG = [
    // ─── Timer Chain ───────────────────────────────────────────
    { id: 'timer_1',    chain: 'timer', title: 'Erste Schritte',    description: 'Schließe deinen allerersten Timer erfolgreich ab.',                     requiredCount: 1,    icon: 'Trophy',   statKey: 'timers' },
    { id: 'timer_10',   chain: 'timer', title: 'Dranbleiber',       description: 'Schließe 10 Timer ab. Du bist auf einem guten Weg!',                    requiredCount: 10,   icon: 'Medal',    statKey: 'timers' },
    { id: 'timer_50',   chain: 'timer', title: 'Fokus-Maschine',    description: '50 Timer abgeschlossen – beeindruckende Disziplin!',                    requiredCount: 50,   icon: 'Award',    statKey: 'timers' },
    { id: 'timer_100',  chain: 'timer', title: 'Centurion',         description: '100 Timer! Deine Ausdauer ist legendär.',                               requiredCount: 100,  icon: 'Award',    statKey: 'timers' },
    { id: 'timer_500',  chain: 'timer', title: 'Halbzeit-Held',     description: '500 Timer absolviert. Der Weg zum Meister ist geebnet.',                 requiredCount: 500,  icon: 'Crown',    statKey: 'timers' },
    { id: 'timer_1000', chain: 'timer', title: 'Meister der Zeit',  description: 'Wahnsinn! 1000 Timer absolviert. Du hast die Zeit im Griff.',           requiredCount: 1000, icon: 'Crown',    statKey: 'timers' },
    { id: 'timer_10000', chain: 'timer', title: 'Ewigkeitssucher', description: '10.000 Timer! Du hast die Zeit transzendiert.',                        requiredCount: 10000, icon: 'Crown',    statKey: 'timers' },

    // ─── Esports Wins Chain (anti-spam: counts distinct won MATCHES) ─
    { id: 'esports_1',    chain: 'esports', title: 'Anfänger-Glück',  description: 'Gewinne deine erste Esports-Wette.',                                  requiredCount: 1,    icon: 'Trophy',   statKey: 'esports_wins' },
    { id: 'esports_5',    chain: 'esports', title: 'Analyst',         description: '5 Matches korrekt vorhergesagt.',                                      requiredCount: 5,    icon: 'Medal',    statKey: 'esports_wins' },
    { id: 'esports_25',   chain: 'esports', title: 'Wett-König',      description: '25 Matches gewonnen – dein Instinkt ist scharf!',                      requiredCount: 25,   icon: 'Award',    statKey: 'esports_wins' },
    { id: 'esports_100',  chain: 'esports', title: 'Orakel',          description: '100 gewonnene Matches. Du siehst die Zukunft.',                         requiredCount: 100,  icon: 'Award',    statKey: 'esports_wins' },
    { id: 'esports_500',  chain: 'esports', title: 'Legende',         description: '500 Siege. Du bist die Esports-Legende dieser Community.',              requiredCount: 500,  icon: 'Crown',    statKey: 'esports_wins' },
    { id: 'esports_1000', chain: 'esports', title: 'Unsterblich',     description: '1000 Matches dominiert. Die Statistiken verneigen sich.',               requiredCount: 1000, icon: 'Crown',    statKey: 'esports_wins' },

    // ─── KoalaFlap Chain ───────────────────────────────────────
    { id: 'flap_1',    chain: 'koalaflap', title: 'Flap-Azubi',       description: 'Spiele deine erste Runde KoalaFlap.',                                 requiredCount: 1,    icon: 'Trophy',   statKey: 'game_rounds' },
    { id: 'flap_10',   chain: 'koalaflap', title: 'Arcade-Gamer',     description: '10 Runden gespielt – der Automat läuft heiß!',                        requiredCount: 10,   icon: 'Medal',    statKey: 'game_rounds' },
    { id: 'flap_100',  chain: 'koalaflap', title: 'Highscore-Jäger',  description: '100 Runden! Du bist ein echter Arcade-Veteran.',                      requiredCount: 100,  icon: 'Award',    statKey: 'game_rounds' },
    { id: 'flap_500',  chain: 'koalaflap', title: 'Flap-Maniac',      description: '500 Runden KoalaFlap – respektable Hartnäckigkeit.',                  requiredCount: 500,  icon: 'Award',    statKey: 'game_rounds' },
    { id: 'flap_1000', chain: 'koalaflap', title: 'Ewiger Koala',     description: '1000 Runden – der Koala fliegt für immer.',                           requiredCount: 1000, icon: 'Crown',    statKey: 'game_rounds' },

    // ─── Special Achievements (standalone, no chain progression) ─
    { id: 'early_bird',      chain: 'timer_early_bird',   title: 'Frühaufsteher',      description: 'Schließe einen Timer zwischen 5:00 und 8:00 Uhr morgens ab.',                          requiredCount: 1,       icon: 'Trophy',   statKey: 'early_bird' },
    { id: 'night_owl',       chain: 'timer_night_owl',    title: 'Nachteule',          description: 'Schließe einen Timer nach Mitternacht ab (0:00–4:00 Uhr).',                             requiredCount: 1,       icon: 'Trophy',   statKey: 'night_owl' },
    { id: 'weekend_warrior', chain: 'timer_weekend',      title: 'Weekend Warrior',    description: 'Schließe am selben Wochenende (Sa + So) jeweils mindestens einen Timer ab.',             requiredCount: 1,       icon: 'Award',    statKey: 'weekend_warrior' },
    { id: 'dagobert',        chain: 'special_dagobert',     title: 'Dagobert Duck',      description: 'Erreiche einen aktiven Kontostand von mindestens 10.000 KoalaCoins.',                    requiredCount: 1000000, icon: 'Crown',    statKey: 'dagobert' },
    { id: 'underdog',        chain: 'esports_underdog',   title: 'Underdog-Experte',   description: 'Gewinne eine Esports-Wette mit einer Quote über 3.0.',                                   requiredCount: 1,       icon: 'Award',    statKey: 'underdog_win' },
    { id: 'loyal_fan',       chain: 'esports_loyal',      title: 'Loyaler Fan',        description: 'Gewinne eine Wette auf dein eigenes Lieblings-Team.',                                    requiredCount: 1,       icon: 'Medal',    statKey: 'loyal_fan' },
    { id: 'critic',          chain: 'special_critic',       title: 'Kritiker',           description: 'Stimme für 10 verschiedene Feature-Vorschläge auf der Roadmap ab.',                        requiredCount: 10,      icon: 'Medal',    statKey: 'vote_count' },
    { id: 'feature_suggest', chain: 'special_feature',      title: 'Visionär',           description: 'Reiche einen eigenen Feature-Vorschlag auf der Roadmap ein.',                              requiredCount: 1,       icon: 'Award',    statKey: 'feature_suggests' },
    { id: 'holzfaeller',     chain: 'koalaflap_lumberjack', title: 'Holzfäller',         description: 'Fliege 50 Mal in Folge gegen das allererste Hindernis (Score = 0). Troll-Achievement!',   requiredCount: 50,      icon: 'Crown',    statKey: 'zero_streak' },

    // ─── Casino & Minigames ─────────────────────────────────────
    { id: 'wordle_1',    chain: 'casino_wordle', title: 'Wort-Lehrling',             description: 'Gewinne dein erstes Wordle-Rätsel.',                             requiredCount: 1,    icon: 'Type',        statKey: 'wordle_wins' },
    { id: 'wordle_10',   chain: 'casino_wordle', title: 'Phrasendrescher',           description: '10 Wordles gelöst. Deine Wortwahl ist exquisit.',               requiredCount: 10,   icon: 'Type',        statKey: 'wordle_wins' },
    { id: 'wordle_50',   chain: 'casino_wordle', title: 'Lexikon auf Beinen',        description: '50 Wordles gelöst. Ein wandelndes Wörterbuch!',                 requiredCount: 50,   icon: 'Type',        statKey: 'wordle_wins' },

    { id: 'fortune_7',   chain: 'casino_fortunes', title: 'Neugierig',                description: 'Öffne 7 Glückskekse. Was bringt die Zukunft?',                  requiredCount: 7,    icon: 'Cookie',      statKey: 'fortunes_count' },
    { id: 'fortune_30',  chain: 'casino_fortunes', title: 'Wochenprophet',            description: '30 Glückskekse geöffnet. Du kennst dein Schicksal.',            requiredCount: 30,   icon: 'Cookie',      statKey: 'fortunes_count' },
    { id: 'fortune_100', chain: 'casino_fortunes', title: 'Schicksalsversteher',      description: '100 Glückskekse! Du liest zwischen den Krümeln.',               requiredCount: 100,  icon: 'Cookie',      statKey: 'fortunes_count' },

    { id: 'bj_50',       chain: 'casino_blackjack', title: 'Hobbyspieler',             description: 'Absolviere 50 Runden Blackjack.',                                requiredCount: 50,   icon: 'Dices',       statKey: 'blackjack_played' },
    { id: 'bj_250',      chain: 'casino_blackjack', title: 'Casino-Stammgast',         description: '250 Runden Blackjack. Der Dealer kennt deinen Namen.',          requiredCount: 250,  icon: 'Dices',       statKey: 'blackjack_played' },
    { id: 'bj_1000',     chain: 'casino_blackjack', title: 'Dealer-Endgegner',         description: '1000 Runden Blackjack. Das Haus zittert vor dir.',              requiredCount: 1000, icon: 'Dices',       statKey: 'blackjack_played' },

    { id: 'tower_10',    chain: 'casino_tower', title: 'Höhenangst-Besieger',        description: 'Absolviere 10 Runden Tower Climb.',                             requiredCount: 10,   icon: 'Layers',      statKey: 'tower_count' },
    { id: 'tower_50',    chain: 'casino_tower', title: 'Stockwerk-Sammler',          description: '50 Runden Tower Climb. Stufe um Stufe nach oben.',              requiredCount: 50,   icon: 'Layers',      statKey: 'tower_count' },
    { id: 'tower_200',   chain: 'casino_tower', title: 'Gipfelstürmer',               description: '200 Runden Tower Climb. Die Aussicht ist herrlich.',            requiredCount: 200,  icon: 'Layers',      statKey: 'tower_count' },

    { id: 'lotto_10',    chain: 'casino_lotto', title: 'Hoffnungsvoll',               description: 'Kaufe 10 Lotto-Tickets. Das große Los wartet!',                 requiredCount: 10,   icon: 'Ticket',      statKey: 'lotto_count' },
    { id: 'lotto_50',    chain: 'casino_lotto', title: 'Lotto-Stammgast',              description: '50 Lotto-Tickets. Treue zahlt sich hoffentlich aus.',           requiredCount: 50,   icon: 'Ticket',      statKey: 'lotto_count' },
    { id: 'lotto_100',   chain: 'casino_lotto', title: 'Optimist',                    description: '100 Lotto-Tickets. Wer nicht wagt, der nicht gewinnt!',        requiredCount: 100,  icon: 'Ticket',      statKey: 'lotto_count' },

    // ─── Soziales ───────────────────────────────────────────────
    { id: 'friends_1',   chain: 'social_friends', title: 'Gefährte',                  description: 'Füge deinen ersten Freund hinzu.',                               requiredCount: 1,    icon: 'Users',       statKey: 'friends' },
    { id: 'friends_5',   chain: 'social_friends', title: 'Beliebter Koala',           description: 'Habe 5 akzeptierte Freunde in deiner Liste.',                    requiredCount: 5,    icon: 'Users',       statKey: 'friends' },
    { id: 'friends_15',  chain: 'social_friends', title: 'Community-Hub',             description: '15 Freunde! Du bist der Mittelpunkt der Party.',                 requiredCount: 15,   icon: 'Users',       statKey: 'friends' },

    // ─── Wirtschaft ─────────────────────────────────────────────
    { id: 'spending_10k', chain: 'economy_spending', title: 'Großzügig',               description: 'Gib insgesamt 10.000 KoalaCoins aus.',                          requiredCount: 1000000, icon: 'ShoppingBag', statKey: 'total_spent' },
    { id: 'spending_50k', chain: 'economy_spending', title: 'Kaufrausch',               description: 'Gib insgesamt 50.000 KoalaCoins aus.',                          requiredCount: 5000000, icon: 'ShoppingBag', statKey: 'total_spent' },
    { id: 'spending_100k',chain: 'economy_spending', title: 'Zentralbank',              description: '100.000 KoalaCoins investiert. Du bewegst den Markt.',          requiredCount: 10000000,icon: 'ShoppingBag', statKey: 'total_spent' },
];

module.exports = { ACHIEVEMENTS_CONFIG };
