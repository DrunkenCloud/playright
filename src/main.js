import { PlaywrightCrawler } from 'crawlee';
import { Actor } from 'apify';

await Actor.init();

let pagesScraped = 0;
const maxPages = 5;


const crawler = new PlaywrightCrawler({   
    launchContext: {
        launchOptions: {
            headless: true,
        },
    },

    // Fixed typo: requst → request
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