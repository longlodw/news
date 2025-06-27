import fetch from "node-fetch";
import puppeteer from "puppeteer";

const URL = 'https://newsdata.io/api/1/latest';

export interface NewsArticle {
  article_id: string;
  title: string;
  link: string;
  pubDate: string;
  pubDateTZ: string;
  content: string;
}

export interface INewsClient {
  fetchLatestNews: (q: string) => Promise<NewsArticle[]>;
}

export class NewsClient implements INewsClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchLatestNews(q: string): Promise<NewsArticle[]> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      q: q,
      language: 'en',
    });
    const response = await fetch(`${URL}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
      },
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch news: ${response.statusText}`);
    }
    const puppeteerBrowser = await puppeteer.launch({
      headless: true,
    });
    const data: any = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error("Invalid response format from news API");
    }
    const contents = await Promise.allSettled(data.results.map(async (article: any) => {
      const page = await puppeteerBrowser.newPage();
      try {
        await page.goto(article.link, { waitUntil: 'networkidle2', timeout: 32000 });
        const content = await page.evaluate(() => {
          const elements = document.querySelectorAll('html');
          return Array.from(elements).map(el => el.innerText).join('\n').trim();
        });

        return {
          article_id: article.article_id,
          title: article.title,
          link: article.link,
          pubDate: article.pubDate,
          pubDateTZ: article.pubDateTZ,
          content: content || "No content available",
        };
      } catch (error) {
        console.warn(`Failed to fetch content for article ${article.article_id}:`, error);
        throw new Error(`Failed to fetch content for article ${article.article_id}`);
      } finally {
        await page.close();
      }
    }));
    return contents.filter(result => result.status === 'fulfilled').map((result: PromiseFulfilledResult<NewsArticle>) => result.value);
  }
}
