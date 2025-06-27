import { createClient, type Client } from "@libsql/client";

export type Role = "model" | "user";

export interface ChatMessage {
  id?: number;
  role: Role;
  content: string;
}

export interface IChatClient {
  store: (message: ChatMessage) => Promise<bigint>;
  load: (id: bigint) => Promise<ChatMessage | null>;
  loadMany: (limit?: number) => Promise<ChatMessage[]>;
}

export class ChatClient implements IChatClient {
  private client: Client;

  static async create(url: string): Promise<ChatClient> {
    const client = createClient({
      url,
    });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL
      );
    `);
    return new ChatClient(client);
  }

  private constructor(client: Client) {
    this.client = client;
  }

  async store(message: ChatMessage): Promise<bigint> {
    const result = await this.client.execute(
      "INSERT INTO chats (role, content) VALUES (?, ?)",
      [message.role, message.content]
    );
    if (result.lastInsertRowid === undefined) {
      throw new Error("Failed to store chat message");
    }
    return result.lastInsertRowid as bigint;
  }

  async load(id: bigint): Promise<ChatMessage | null> {
    const result = await this.client.execute("SELECT id, role, content FROM chats WHERE id = ?", [id]);
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return { id: row[0] as number, role: row[1] as Role, content: row[2] as string };
  }

  async loadMany(limit = 16): Promise<ChatMessage[]> {
    const result = await this.client.execute("SELECT id, role, content FROM chats ORDER BY id DESC LIMIT ?", [limit]);
    return result.rows.map((row) => ({
      id: row[0] as number,
      role: row[1] as Role,
      content: row[2] as string,
    })).reverse(); // Reverse to maintain chronological order
  }
}
