import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();

const startUrls = [
    { url: 'https://www.amazon.com/s?i=software-intl-ship&srs=16225008011&rh=n%3A16225008011&s=popularity-rank&fs=true' }
];

const MAX_PAGES = 2;
let pagesScraped = 0;

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: true,
            browserName: 'firefox',
        },
    },

    async requestHandler({ page, request, enqueueLinks, log }) {
        log.info(`Scraping: ${request.url}`);
        pagesScraped++; 

        await page.waitForSelector('.s-card-container', { timeout: 30000 });

        const products = await page.$$eval(
            '.s-card-container',
            (items) => {
                return items.map(item => {
                    const titleElement = item.querySelector('.a-size-medium');
                    const title = titleElement ? titleElement.innerText.trim() : null;
                    
                    let price = null;
                    
                    const offscreenPrice = item.querySelector('.a-price > .a-offscreen');
                    if (offscreenPrice) {
                        price = offscreenPrice.innerText.trim();
                    } 
                    else {
                        const visiblePrice = item.querySelector('.a-price[data-a-size="xl"] > span:first-of-type');
                        if (visiblePrice) {
                            price = visiblePrice.innerText.trim();
                        }
                        else {
                            const altPrice = item.querySelector('.a-row.a-size-base.a-color-secondary > .a-color-base');
                            if (altPrice) {
                                price = altPrice.innerText.trim();
                            }
                        }
                    }

                    const ratingElement = item.querySelector('.a-icon-alt');
                    const rating = ratingElement ? ratingElement.innerText.trim() : null;

                    return { title, price, rating };
                });
            }
        );

        log.info(`Found ${products.length} products on the page`);
        
        for (const product of products) {
            console.log(product)
            if (product.title) {
                await Actor.pushData(product);
            }
        }

        if (pagesScraped < MAX_PAGES) {
            try {
                const nextPageButton = await page.$('a.s-pagination-next:not(.s-pagination-disabled)');
                
                if (nextPageButton) {
                    const nextPageHref = await nextPageButton.evaluate(el => el.href);
                    if (nextPageHref) {
                        log.info(`Enqueuing next page (${pagesScraped}/${MAX_PAGES}): ${nextPageHref}`);
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
            log.info(`Reached maximum page limit (${MAX_PAGES}), stopping pagination`);
        }
    },

    requestHandlerTimeoutSecs: 120,
    maxConcurrency: 2,
    maxRequestRetries: 3,
});

await crawler.run(startUrls);

await Actor.exit();