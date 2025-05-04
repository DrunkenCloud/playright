import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

await Actor.init();

const startUrl = await Actor.getInput();
const {
    startUrls = [{ url: startUrl.url }],
    maxPages = 2,
    useApifyProxy = false,
    debugMode = false
} = input || {};

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

        await page.waitForSelector('.s-card-container', { timeout: 30000 });

        if (debugMode) {
            await page.waitForTimeout(2000);
        }

        const products = await page.$$eval(
            '.s-card-container',
            (items) => {
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

                    return { 
                        title, 
                        price, 
                        rating
                    };
                });
            }
        );

        log.info(`Found ${products.length} products on the page`);
        
        for (const product of products) {
            if (product.title) {
                await Actor.pushData(product);
            }
        }

        if (pagesScraped < maxPages) {
            try {
                const nextPageButton = await page.$('a.s-pagination-next:not(.s-pagination-disabled)');
                
                if (nextPageButton) {
                    const nextPageHref = await nextPageButton.evaluate(el => el.href);
                    if (nextPageHref) {
                        log.info(`Enqueuing next page (${pagesScraped}/${maxPages}): ${nextPageHref}`);
                        await crawler.addRequests([{ url: nextPageHref }]);
                    } else {
                        log.info('No next page URL found');
                    }
                } else {
                    log.info('Next page button not found or disabled - reached the end');
                }
            } catch (error) {
                log.error(`Error handling pagination: ${error.message}`);
            }
        } else {
            log.info(`Reached maximum page limit (${maxPages}), stopping pagination`);
        }
    },

    requestHandlerTimeoutSecs: 120,
    maxConcurrency: 2,
    maxRequestRetries: 3,
});

log.info('Starting the crawl...');
await crawler.run(startUrls);

log.info('Crawl finished, exiting actor...');
await Actor.exit();