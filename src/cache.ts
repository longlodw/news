import { createClient, type Client } from "@libsql/client";

export interface ICacheClient {
  store: (key: string, value: string) => Promise<void>;
  load: (key: string) => Promise<string | null>;
  loadMany: (limit?: number) => Promise<Array<{ key: string; value: string }>>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export class CacheClient implements ICacheClient {
  private client: Client;

  static async create(url: string): Promise<CacheClient> {
    const client = createClient({
      url,
    });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return new CacheClient(client);
  }

  private constructor(client: Client) {
    this.client = client;
  }

  async store(key: string, value: string): Promise<void> {
    await this.client.execute(
      "INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)",
      [key, value]
    );
  }

  async load(key: string): Promise<string | null> {
    const result = await this.client.execute("SELECT value FROM cache WHERE key = ?", [key]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0][0] as string;
  }

  async loadMany(limit: number = 1): Promise<Array<{ key: string; value: string }>> {
    const result = await this.client.execute(`
      SELECT key, value FROM cache
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);
    return result.rows.map(row => ({
      key: row[0] as string,
      value: row[1] as string,
    })).reverse();
  }

  async delete(key: string): Promise<void> {
    await this.client.execute("DELETE FROM cache WHERE key = ?", [key]);
  }

  async clear(): Promise<void> {
    await this.client.execute("DELETE FROM cache");
  }
}
