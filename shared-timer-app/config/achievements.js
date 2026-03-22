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
];

module.exports = { ACHIEVEMENTS_CONFIG };
