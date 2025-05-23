import { PlaywrightCrawler } from 'crawlee';
import { Actor } from 'apify';

await Actor.init();

let pagesScraped = 0;
const maxPages = 5;

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--disable-gpu', // Mitigates the "crashing GPU process" issue in Docker containers
            ]
        },
    },

    async requestHandler({ request, page, log }) {
        log.info(`Processing ${request.url}...`);
        pagesScraped++;

        try {
            await page.waitForSelector('.s-card-container', { 
                timeout: 30000,
                state: 'visible'
            });

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

                        const asin = item.getAttribute('data-asin') || null;

                        return { 
                            title, 
                            price, 
                            rating,
                            asin
                        };
                    }).filter(product => product.title);
                }
            );
            
            if (products.length > 0) {
                await Actor.pushData(products);
                log.info(`Extracted ${products.length} products`);
            } else {
                log.warning('No products found on this page');
            }
            if (pagesScraped < maxPages) {
                try {
                    await page.waitForSelector('.s-pagination-container', { timeout: 10000 });
                    
                    const nextButtonExists = await page.$$eval(
                        'a.s-pagination-next', 
                        (elements) => elements.length > 0 && !elements[0].classList.contains('s-pagination-disabled')
                    );
                    
                    if (nextButtonExists) {
                        const nextPageUrl = await page.$eval('a.s-pagination-next', el => el.href);
                        log.info(`Enqueuing next page: ${nextPageUrl}`);
                        await crawler.addRequests([{ url: nextPageUrl }]);
                    } else {
                        log.info('No more pages available');
                    }
                } catch (error) {
                    log.error(`Error handling pagination: ${error.message}`);
                }
            } else {
                log.info(`Reached maximum page limit (${maxPages}), stopping pagination`);
            }
        } catch (error) {
            log.error(`Failed to process ${request.url}: ${error.message}`);
        }
    },
    
    failedRequestHandler({ request, error }) {
        console.error(`Request ${request.url} failed: ${error.message}`);
    },
    
    maxRequestsPerCrawl: 50,
});

try {
    await crawler.run(['https://www.amazon.com/s?i=software-intl-ship&srs=16225008011&rh=n%3A16225008011&s=popularity-rank&fs=true']);
    console.log('Crawler finished successfully.');
} catch (error) {
    console.error(`Crawler failed: ${error.message}`);
} finally {
    await Actor.exit();
}