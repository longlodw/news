import { createClient, type Client } from "@libsql/client";

export interface ApiKey {
  key: string;
  url: string;
}

export interface IApiKeyClient {
  store: (key: ApiKey) => Promise<void>;
  load: (key: string) => Promise<ApiKey | null>;
  loadMany: (limit?: number) => Promise<ApiKey[]>;
}

export class ApiKeyClient implements IApiKeyClient {
  private client: Client;
  static async create(url: string): Promise<ApiKeyClient> {
    const client = createClient({
      url,
    });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        key TEXT NOT NULL UNIQUE PRIMARY KEY,
        url TEXT NOT NULL
      );
    `)
    return new ApiKeyClient(client);
  }

  private constructor(client: Client) {
    this.client = client;
  }

  async store(key: ApiKey): Promise<void> {
    await this.client.execute(
      "INSERT OR REPLACE INTO api_keys (key, url) VALUES (?, ?)",
      [key.key, key.url]
    );
  }

  async load(key: string): Promise<ApiKey | null> {
    const result = await this.client.execute("SELECT key, url FROM api_keys WHERE key = ?", [key]);
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return { key: row[0] as string, url: row[1] as string };
  }

  async loadMany(limit = 10): Promise<ApiKey[]> {
    const result = await this.client.execute("SELECT key, url FROM api_keys LIMIT ?", [limit]);
    return result.rows.map((row) => ({
      key: row[0] as string,
      url: row[1] as string,
    }));
  }
}
