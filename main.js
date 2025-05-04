import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

Actor.main(async () => {
    try {
        const userInput = await Actor.getInput();
        const {
            startUrls = [{ url: userInput.url }],
            maxPages = 2,
            useApifyProxy = false,
            debugMode = false
        } = input || {};

        log.info('Starting Amazon scraper with configuration:', {
            startUrls: startUrls.map(u => u.url),
            maxPages,
            useProxy: useApifyProxy,
            debugMode,
        });

        const proxyConfiguration = await Actor.createProxyConfiguration({ useApifyProxy });

        let pagesScraped = 0;

        const crawler = new PlaywrightCrawler({
            proxyConfiguration,
            launchContext: {
                launchOptions: {
                    headless: !debugMode,
                    browserName: 'firefox',
                },
            },
            async requestHandler({ page, request, log }) {
                log.info(`Scraping: ${request.url}`);
                pagesScraped++;

                const isBlocked = await page.$('form[action="/errors/validateCaptcha"]');
                if (isBlocked) {
                    log.warning('Blocked by CAPTCHA. Skipping...');
                    return;
                }

                await page.waitForSelector('.s-card-container', { timeout: 5000 });

                let products = [];
                try {
                    products = await page.$$eval('.s-card-container', (items) => {
                        return items.map(item => {
                            const titleElement = item.querySelector('.a-size-medium') || 
                                                item.querySelector('h2 .a-link-normal') ||
                                                item.querySelector('.a-size-base-plus');
                            const title = titleElement ? titleElement.innerText.trim() : null;
                            
                            const priceElement = item.querySelector('.a-price > .a-offscreen') || 
                                                item.querySelector('.a-price[data-a-size="xl"] > span:first-of-type') ||
                                                item.querySelector('.a-row.a-size-base.a-color-secondary > .a-color-base');
                            const price = priceElement ? priceElement.innerText.trim() : null;

                            const ratingElement = item.querySelector('.a-icon-alt');
                            const rating = ratingElement ? ratingElement.innerText.trim() : null;

                            return { title, price, rating };
                        });
                    });
                } catch (err) {
                    log.error(`Extraction error: ${err.message}`);
                }

                log.info(`Found ${products.length} products`);
                for (const product of products) {
                    if (product.title) {
                        await Actor.pushData(product);
                    }
                }

                if (pagesScraped < maxPages) {
                    const nextPageLink = await page.$('a.s-pagination-next:not(.s-pagination-disabled)');
                    if (nextPageLink) {
                        const href = await nextPageLink.evaluate(el => el.href);
                        if (href) {
                            await crawler.addRequests([{ url: href }]);
                        }
                    }
                }
            },
            requestHandlerTimeoutSecs: 120,
            maxConcurrency: 2,
        });

        await crawler.run(startUrls);
    } catch (err) {
        log.error('Unhandled exception:', err);
        process.exit(1);
    }
});
