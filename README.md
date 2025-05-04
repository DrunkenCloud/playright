# 📦 Amazon Category Scraper using Apify + Playwright

This Actor scrapes product details (title, price, and rating) from a category page on [Amazon.com](https://www.amazon.com) using Playwright inside the Apify platform. It supports automatic pagination (currently being rate limited to 5 paginations) and outputs structured product data in JSON format.

---

## 📥 Input

The starting URL is hardcoded inside `main.js`:
```js
const startUrls = [
    { url: 'https://www.amazon.com/b?node=16225008011' }
];
