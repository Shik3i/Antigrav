const routePrefetchers = new Map([
    ['/esports', () => import('../pages/Esports')],
    ['/highscores', () => import('../pages/Highscores')],
    ['/koala-dashboard', () => import('../pages/KoalaDashboard')],
    ['/global-bets', () => import('../pages/GlobalBets')],
    ['/admin', () => import('../pages/Admin')],
    ['/features', () => import('../pages/FeatureRequests')],
    ['/achievements', () => import('../pages/Achievements')],
    ['/scratchcards', () => import('../pages/ScratchcardShop')],
    ['/games/rift-defense', () => import('../pages/RiftDefense')],
    ['/games/lol-idle', () => import('../pages/LoLIdleGame')],
    ['/color-sync', () => import('../pages/ColorSyncGame')],
    ['/games/leaderboard', () => import('../pages/GameLeaderboards')],
    ['/changelog', () => import('../pages/Changelog')],
    ['/api-docs', () => import('../pages/ApiDocs')],
    ['/extension-info', () => import('../pages/ExtensionInfo')],
    ['/speedcube', () => import('../pages/SpeedcubeTimer')],
    ['/c', () => import('../pages/SharedCountdown')],
    ['/leveling', () => import('../pages/LevelingTracker')],
    ['/polymarket-general', () => import('../pages/PolymarketGeneral')],
    ['/tetris', () => import('../pages/Tetris')],
    ['/wordle', () => import('../pages/Wordle')],
    ['/games/koalaflap', () => import('../pages/KoalaFlap')],
    ['/games/tower-climb', () => import('../pages/TowerClimb')],
]);

const prefetchedRoutes = new Set();

export const prefetchRoute = (path) => {
    const loader = routePrefetchers.get(path);
    if (!loader || prefetchedRoutes.has(path)) return;

    prefetchedRoutes.add(path);
    void loader().catch(() => {
        prefetchedRoutes.delete(path);
    });
};
