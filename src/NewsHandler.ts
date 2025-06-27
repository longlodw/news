import { createPartFromUri, createUserContent, type Content, type File } from "@google/genai";
import type { IChatClient } from "./chat.js";
import type { IGeminiClient } from "./gemini.js";
import type { INewsClient } from "./news.js";
import type { ICacheClient } from "./cache.js";

export class NewsHandler {
  private newsClient: INewsClient;
  private chatClient: IChatClient;
  private geminiClient: IGeminiClient;
  private cacheClient: ICacheClient;

  constructor(newsClient: INewsClient, chatClient: IChatClient, geminiClient: IGeminiClient, cacheClient: ICacheClient) {
    this.newsClient = newsClient;
    this.chatClient = chatClient;
    this.geminiClient = geminiClient;
    this.cacheClient = cacheClient;
  }

  async post(): Promise<number> {
    const oldChats = await this.chatClient.loadMany(16);
    // get user interests based on the last 16 chats
    const contents = oldChats.map(chat => ({
      role: chat.role,
      content: [chat.content],
    })) as Content[];
    let interests;
    if (contents.length !== 0) {
      contents.push(createUserContent("based on the above chats, what are the user's interests? Output the interests in 1 phrase") as Content);
      const response = await this.geminiClient.generateText(contents);
      interests = response.trim().toLowerCase();
    } else {
      // if no chats, use a default interest
      interests = "finance";
    }
    const newsArticles = await this.newsClient.fetchLatestNews(interests);
    for (const article of newsArticles) {
      console.log(`Fetched article: ${article.title} (${article.article_id}) snippet: ${article.content.slice(0, 100)}...)`);
    }
    if (newsArticles.length === 0) {
      console.warn("No news articles found for the user's interests");
      return 0;
    }
    const fileResults = await Promise.allSettled(newsArticles.map(async article => await this.geminiClient.uploadFile(new Blob(
      [JSON.stringify(article)],
      { type: "application/json" },
    ))));
    const files = fileResults
      .filter(result => result.status === "fulfilled")
      .map((result: PromiseFulfilledResult<File>) => result.value);
    console.log(`Uploaded ${files.length} files to Gemini`);
    const cacheId = await this.geminiClient.createCache(
      files.map(file => createPartFromUri(file.uri!, file.mimeType!)),
      "You are a news aggregator. You will receive a list of news articles. Your task is to help the user understand the content. When answering, always refer to the article's title and content. Be sure to predict the user's next actions and suggest follow up questions that the user can ask based on the prediction."
    );
    await this.cacheClient.store(cacheId, cacheId);
    return files.length;
  }
}
