const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
            console.log(`[NAVIGATION] Main frame navigated to: ${frame.url()}`);
        }
    });

    console.log('Navigating to login...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2' });

    console.log('Logging in...');
    await page.type('input[type="text"]', 'test1234');
    await page.type('input[type="password"]', '123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Logged in! Current URL:', page.url());

    await new Promise(r => setTimeout(r, 1000));

    console.log('Clicking Settings link...');
    const settingsLink = await page.$('a[href="/settings"]');
    if (settingsLink) {
        await settingsLink.click();
        console.log('Clicked! Waiting for network or idle...');
        await new Promise(r => setTimeout(r, 2000));
    }

    await browser.close();
})();
