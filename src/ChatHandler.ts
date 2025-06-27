import { createModelContent, createUserContent } from "@google/genai";
import type { ICacheClient } from "./cache.js";
import { type Role, type IChatClient } from "./chat.js";
import type { IGeminiClient } from "./gemini.js";

export class ChatHandler {
  private chatClient: IChatClient
  private cacheClient: ICacheClient
  private geminiClient: IGeminiClient;

  constructor(chatClient: IChatClient, cacheClient: ICacheClient, geminiClient: IGeminiClient) {
    this.chatClient = chatClient;
    this.cacheClient = cacheClient;
    this.geminiClient = geminiClient;
  }

  async post(q: string): Promise<string> {
    const cacheId = await this.cacheClient.loadMany(1);
    const pastChats = await this.chatClient.loadMany(16);
    const contents = pastChats.map(chat => ({
      role: chat.role,
      content: chat.content,
    }));
    const question = {
      role: "user" as Role,
      content: q,
    };
    contents.push(question);
    const response = await this.geminiClient.generateText(contents.map(content => {
      switch (content.role) {
        case "model":
          return createModelContent(content.content);
        case "user":
          return createUserContent(content.content);
      }
    }));
    const message = {
      role: 'model' as Role,
      content: response,
    };
    await this.chatClient.store(question);
    await this.chatClient.store(message);
    return response;
  }
}
