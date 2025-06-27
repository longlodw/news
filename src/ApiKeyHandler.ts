import { randomUUID } from "crypto";
import type { IApiKeyClient } from "./apikey.js";
import { sha256 } from "hono/utils/crypto";
import fs from "fs";

export class ApiKeyHandler {
  private base: string;
  private apiKeyClient: IApiKeyClient;

  constructor(base: string, apiKeyClient: IApiKeyClient) {
    this.base = base;
    this.apiKeyClient = apiKeyClient;
  }

  async post(): Promise<string> {
    const randId = randomUUID()
    const key = `key-${randId}`;
    const hashedKey = await sha256(key);
    const url = `${this.base}/${hashedKey}`;
    fs.mkdirSync(url, { recursive: true });
    await this.apiKeyClient.store({
      key,
      url,
    });
    return key;
  }
}
