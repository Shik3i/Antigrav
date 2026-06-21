const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message, '\nStack:', error.stack));

    await page.goto('http://localhost:5173/login');
    await page.type('input[type="text"]', 'admin_koala');
    await page.type('input[type="password"]', 'koala');
    await page.click('button[type="submit"]');

    await page.waitForNavigation();
    console.log("Logged in");

    await page.goto('http://localhost:5173/admin');
    console.log("On Admin page");

    // wait a bit
    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
