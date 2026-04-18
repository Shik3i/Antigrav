const Parser = require('rss-parser');
const dbLayer = require('../database');

const parser = new Parser({
    timeout: 10000, // 10 seconds timeout to prevent hanging on slow feeds
    customFields: {
        item: [
            ['media:content', 'mediaContent', { keepArray: true }],
            ['enclosure', 'enclosure', { keepArray: true }],
            ['description', 'description'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});

/**
 * Extracts a thumbnail image URL from an RSS item using common tags and fallbacks.
 */
function extractImage(item) {
    // 1. media:content (Tagesschau uses this)
    if (item.mediaContent && item.mediaContent.length > 0) {
        const m = item.mediaContent[0];
        // Note: rss-parser might return attributes in .$.url or just .url depending on the tag
        if (m.$ && m.$.url) return m.$.url;
        if (m.url) return m.url;
    }

    // 2. enclosure (Standard RSS images)
    if (item.enclosure && item.enclosure.length > 0) {
        const e = item.enclosure[0];
        if (e.$ && e.$.url) return e.$.url;
        if (e.url) return e.url;
        // Some feeds use .attribute.url
        if (e.attributes && e.attributes.url) return e.attributes.url;
    }

    // 3. Search in description or contentEncoded for <img> tags
    const html = item.contentEncoded || item.description || '';
    const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];

    // 4. Check for itunes:image (podcasts)
    if (item['itunes:image']) return item['itunes:image'];

    return null;
}

/**
 * Refreshes a single RSS feed by its database ID and URL.
 */
async function refreshFeed(feedId, url) {
    try {
        const feed = await parser.parseURL(url);
        
        // Map to our internal article format
        const articles = feed.items.map(item => ({
            title: item.title || 'Kein Titel',
            link: item.link,
            imageUrl: extractImage(item),
            snippet: (item.contentSnippet || item.description || '').replace(/<[^>]*>?/gm, '').substring(0, 250),
            pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
        }));

        // Limit to last 100 articles to prevent DB bloat
        const limitedArticles = articles.slice(0, 100);

        await dbLayer.updateRssArticlesCache(feedId, limitedArticles);
        return limitedArticles.length;
    } catch (err) {
        console.error(`[RSS Service] Failed to refresh feed ${feedId} (${url}):`, err.message);
        throw err; // Re-throw to allow caller to handle/log
    }
}

/**
 * Iterates through all feeds in the database and updates their cache.
 */
async function refreshAllFeeds() {
    const feeds = await dbLayer.getRssFeeds();
    const stats = { total: feeds.length, success: 0, failed: 0 };

    for (const feed of feeds) {
        try {
            await refreshFeed(feed.id, feed.url);
            stats.success++;
        } catch (err) {
            stats.failed++;
            console.warn(`[RSS Service] Feed refresh failed for ${feed.name} (${feed.url}): ${err.message}`);
            // Individual failures are non-critical, so we don't throw, 
            // but we log it to SystemLogs for admin visibility
            dbLayer.logSystemEvent('warn', 'rssService', `Refresh failed for ${feed.name}: ${err.message}`).catch(() => {});
        }
    }

    return stats;
}

module.exports = {
    refreshFeed,
    refreshAllFeeds
};
