import { createModelContent, createUserContent, type Content } from "@google/genai";
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
    const contents = oldChats.map(chat => {
      switch (chat.role) {
        case "model":
          return createModelContent(chat.content) as Content;
        case "user":
          return createUserContent(chat.content) as Content;
      }
    }) as Content[];
    let interests;
    if (contents.length !== 0) {
      contents.push(createUserContent("based on the above chats, what are the user's interests? Output the interests in 1 short phrase. For example, 'USA tariff'") as Content);
      const response = await this.geminiClient.generateText(contents);
      interests = response.trim().toLowerCase();
    } else {
      // if no chats, use a default interest
      interests = "finance";
    }
    console.log(`User interests: ${interests}`);
    const newsArticles = await this.newsClient.fetchLatestNews(interests);
    if (newsArticles.length === 0) {
      console.warn(`No news articles found for the user's interests ${interests}`);
      return 0;
    }
    const cacheId = await this.geminiClient.createCache([
      "You are a news aggregator. You will receive a list of news articles. Your task is to help the user understand the content. When answering, always refer to the article's title and content. Here is the list of news articles in JSON format:",
      JSON.stringify(newsArticles),
      "When addressing the user, always speak in paragraphs and not in bullet points. Always use the article's title and content to answer the user's questions. If the user asks about a specific article, refer to its title and content.",
      "Be sure to predict the user's next actions and address them to suggest follow up questions that the user can ask based on the prediction.",
      "When suggesting follow-up questions, only suggest questions that can be answered in details using the articles."
    ]);
    await this.cacheClient.store(cacheId, cacheId);
    return newsArticles.length;
  }
}
