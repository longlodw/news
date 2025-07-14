import { Context, Markup, Telegraf} from 'telegraf';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
import { createClient, type Client } from '@libsql/client';



// Function to properly format markdown for Telegram MarkdownV2
function formatMarkdown(text: string): string {
  // Handle bullet points first - convert * to • for better display
  let formatted = text.replace(/^(\s*)\*(\s+)/gm, '$1•$2');
  
  // Handle bold text - convert **text** to *text* (Telegram's bold format)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');
  
  // Handle italic text - preserve _ around words
  formatted = formatted.replace(/_([^_]+)_/g, '_$1_');
  
  // Handle code blocks - preserve ` around words
  formatted = formatted.replace(/`([^`]+)`/g, '`$1`');
  
  // Now escape all remaining special characters that aren't part of markdown syntax
  formatted = formatted
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
  
  return formatted;
}

// Function to safely send formatted messages
async function sendFormattedMessage(ctx: Context, text: string, keyboard?: any): Promise<void> {
  try {
    const formatted = formatMarkdown(text);
    const options: any = { parse_mode: 'MarkdownV2' };
    if (keyboard) {
      options.reply_markup = keyboard.reply_markup;
    }
    await ctx.reply(formatted, options);
  } catch (error) {
    console.error('Error formatting message:', error);
    // Fallback to plain text if markdown formatting fails
    try {
      const options: any = {};
      if (keyboard) {
        options.reply_markup = keyboard.reply_markup;
      }
      await ctx.reply(text, options);
    } catch (fallbackError) {
      console.error('Error sending fallback message:', fallbackError);
      await ctx.reply('An error occurred while sending the message.');
    }
  }
}

// Create main menu keyboard
function getMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📰 Latest News', 'news'),
      Markup.button.callback('💰 Finance News', 'finance')
    ],
    [
      Markup.button.callback('💻 Tech News', 'tech'),
      Markup.button.callback('🔍 Search', 'search')
    ],
    [
      Markup.button.callback('❓ Help', 'help')
    ]
  ]);
}

// Create search categories keyboard
function getSearchCategoriesKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🤖 AI & Technology', 'search_ai'),
      Markup.button.callback('💰 Business & Finance', 'search_business')
    ],
    [
      Markup.button.callback('🌍 World News', 'search_world'),
      Markup.button.callback('🏥 Health & Science', 'search_health')
    ],
    [
      Markup.button.callback('🎬 Entertainment', 'search_entertainment'),
      Markup.button.callback('⚽ Sports', 'search_sports')
    ],
    [
      Markup.button.callback('🔙 Back to Main Menu', 'main_menu')
    ]
  ]);
}

// Helper for chat_id <-> api_key mapping using libsql
class ChatKeyStore {
  private client: Client;
  constructor(client: Client) {
    this.client = client;
  }
  static async create(dbPath: string): Promise<ChatKeyStore> {
    const client = createClient({ url: `file:${dbPath}` });
    await client.execute(`CREATE TABLE IF NOT EXISTS chat_keys (
      chat_id TEXT PRIMARY KEY,
      api_key TEXT NOT NULL
    )`);
    return new ChatKeyStore(client);
  }
  async getApiKey(chatId: string): Promise<string|null> {
    const result = await this.client.execute(
      'SELECT api_key FROM chat_keys WHERE chat_id = ?',
      [chatId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0][0] as string;
  }
  async setApiKey(chatId: string, apiKey: string): Promise<void> {
    await this.client.execute(
      'INSERT OR REPLACE INTO chat_keys (chat_id, api_key) VALUES (?, ?)',
      [chatId, apiKey]
    );
  }
}

async function main() {
  // Parse command line arguments
  const argv = await yargs(hideBin(process.argv))
    .option('token', {
      alias: 't',
      type: 'string',
      description: 'Telegram Bot Token',
      demandOption: true,
    })
    .option('host', {
      alias: 'H',
      type: 'string',
      description: 'Host for chat service',
      default: 'localhost',
    })
    .option('port', {
      alias: 'P',
      type: 'number',
      description: 'Port for chat service',
      default: 3000,
    })
    .option('sqlite-path', {
      alias: 's',
      type: 'string',
      description: 'Path to SQLite file for chat id to api key mapping',
      demandOption: true,
    })
    .parse();

  if (!argv.token) {
    console.error('Error: --token are required');
    process.exit(1);
  }
  const bot = new Telegraf(argv.token);

  // Initialize ChatKeyStore once
  const chatKeyStore = await ChatKeyStore.create(argv['sqlite-path']);

  // Start command with main menu
  bot.start((ctx: Context) => {
    const welcomeMessage = 'Welcome to the News Bot! 🤖\n\nChoose an option from the menu below:';
    sendFormattedMessage(ctx, welcomeMessage, getMainMenuKeyboard());
  });

  // Help command
  bot.help((ctx: Context) => {
    const helpMessage = `Available Commands:

📰 *News & Information*
• /news - Get latest news summary
• /finance - Financial news and market updates
• /tech - Technology news and developments
• /search - Search for information on any topic

💬 *Chat*
• Send any text message to chat with AI assistant

Use the buttons below or type commands directly!`;
    sendFormattedMessage(ctx, helpMessage, getMainMenuKeyboard());
  });

  // News command
  bot.command('news', async (ctx: Context) => {
    await handleNewsRequest(ctx, argv, chatKeyStore);
  });

  // Finance command
  bot.command('finance', async (ctx: Context) => {
    await handleFinanceRequest(ctx, argv, chatKeyStore);
  });

  // Tech command
  bot.command('tech', async (ctx: Context) => {
    await handleTechRequest(ctx, argv, chatKeyStore);
  });

  // Search command
  bot.command('search', async (ctx: Context) => {
    const message = ctx.message;
    if (message && 'text' in message) {
      const query = message.text.replace(/^\/search\s*/, '').trim();
      if (query) {
        await handleSearchRequest(ctx, argv, query, chatKeyStore);
      } else {
        sendFormattedMessage(ctx, 'Please provide a search query or choose a category:', getSearchCategoriesKeyboard());
      }
    }
  });



  // Handle callback queries (button clicks)
  bot.action('main_menu', async (ctx: Context) => {
    const message = 'Main Menu - Choose an option:';
    sendFormattedMessage(ctx, message, getMainMenuKeyboard());
  });

  bot.action('news', async (ctx: Context) => {
    await handleNewsRequest(ctx, argv, chatKeyStore);
  });

  bot.action('finance', async (ctx: Context) => {
    await handleFinanceRequest(ctx, argv, chatKeyStore);
  });

  bot.action('tech', async (ctx: Context) => {
    await handleTechRequest(ctx, argv, chatKeyStore);
  });

  bot.action('search', async (ctx: Context) => {
    sendFormattedMessage(ctx, '🔍 Search Information\n\nChoose a category or type /search <query>:', getSearchCategoriesKeyboard());
  });

  bot.action('help', async (ctx: Context) => {
    const helpMessage = `Available Commands:

📰 *News & Information*
• /news - Get latest news summary
• /finance - Financial news and market updates
• /tech - Technology news and developments
• /search - Search for information on any topic

💬 *Chat*
• Send any text message to chat with AI assistant

Use the buttons below or type commands directly!`;
    sendFormattedMessage(ctx, helpMessage, getMainMenuKeyboard());
  });

  // Search category buttons
  bot.action('search_ai', async (ctx: Context) => {
    await handleSearchRequest(ctx, argv, 'artificial intelligence trends 2024', chatKeyStore);
  });

  bot.action('search_business', async (ctx: Context) => {
    await handleSearchRequest(ctx, argv, 'business and finance news', chatKeyStore);
  });

  bot.action('search_world', async (ctx: Context) => {
    await handleSearchRequest(ctx, argv, 'world news today', chatKeyStore);
  });

  bot.action('search_health', async (ctx: Context) => {
    await handleSearchRequest(ctx, argv, 'health and science news', chatKeyStore);
  });

  bot.action('search_entertainment', async (ctx: Context) => {
    await handleSearchRequest(ctx, argv, 'entertainment news', chatKeyStore);
  });

  bot.action('search_sports', async (ctx: Context) => {
    await handleSearchRequest(ctx, argv, 'sports news today', chatKeyStore);
  });

  // Initialize ChatKeyStore once
  // const chatKeyStore = await ChatKeyStore.create(argv['sqlite-path']); // Moved outside main

  // Handle text messages (chat)
  bot.on('text', async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString();
    if (!chatId) {
      await sendFormattedMessage(ctx, '❌ Unable to identify chat.', getMainMenuKeyboard());
      return;
    }
    let apiKey = await chatKeyStore.getApiKey(chatId);
    if (!apiKey) {
      // Generate new API key
      const res = await fetch(`http://${argv.host}:${argv.port}/api/apikey`, { method: 'POST' });
      if (!res.ok) {
        await sendFormattedMessage(ctx, '❌ Failed to generate API key.', getMainMenuKeyboard());
        return;
      }
      const data = (await res.json()) as { key?: string };
      if (!data.key) {
        await sendFormattedMessage(ctx, '❌ Invalid API key response.', getMainMenuKeyboard());
        return;
      }
      apiKey = data.key;
      await chatKeyStore.setApiKey(chatId, apiKey);
    }
    if (!apiKey) {
      await sendFormattedMessage(ctx, '❌ No API key available.', getMainMenuKeyboard());
      return;
    }
    const response = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
      headers: {
        'Content-Type': 'text/plain',
        'x-api-key': apiKey,
      },
      method: 'POST',
      body: ctx.text ?? '',
    });
    const responseText = await response.text();
    sendFormattedMessage(ctx, responseText, getMainMenuKeyboard());
  });

  await bot.launch();
  console.log('🤖 Telegram bot is running with inline buttons...');
}

// Helper functions for handling different requests
async function handleNewsRequest(ctx: Context, argv: any, chatKeyStore: ChatKeyStore) {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) {
    await sendFormattedMessage(ctx, '❌ Unable to identify chat.', getMainMenuKeyboard());
    return;
  }
  let apiKey = await chatKeyStore.getApiKey(chatId);
  if (!apiKey) {
    const res = await fetch(`http://${argv.host}:${argv.port}/api/apikey`, { method: 'POST' });
    if (!res.ok) {
      await sendFormattedMessage(ctx, '❌ Failed to generate API key.', getMainMenuKeyboard());
      return;
    }
    const data = (await res.json()) as { key?: string };
    if (!data.key) {
      await sendFormattedMessage(ctx, '❌ Invalid API key response.', getMainMenuKeyboard());
      return;
    }
    apiKey = data.key;
    await chatKeyStore.setApiKey(chatId, apiKey);
  }
  try {
    const chatRes = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
      headers: {
        'x-api-key': apiKey,
        'content-type': 'text/plain',
      },
      method: 'POST',
      body: "give me a summary of the latest news that I would be interested in",
    });
    if (!chatRes.ok) {
      console.error(chatRes.status, chatRes.statusText);
      sendFormattedMessage(ctx, '❌ Failed to fetch news', getMainMenuKeyboard());
      return;
    }
    const chatText = await chatRes.text();
    sendFormattedMessage(ctx, `📰 Latest News Summary:\n\n${chatText}`, getMainMenuKeyboard());
  } catch (error) {
    console.error('Error fetching news:', error);
    sendFormattedMessage(ctx, '❌ An error occurred while fetching news.', getMainMenuKeyboard());
  }
}

async function handleFinanceRequest(ctx: Context, argv: any, chatKeyStore: ChatKeyStore) {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) {
    await sendFormattedMessage(ctx, '❌ Unable to identify chat.', getMainMenuKeyboard());
    return;
  }
  let apiKey = await chatKeyStore.getApiKey(chatId);
  if (!apiKey) {
    const res = await fetch(`http://${argv.host}:${argv.port}/api/apikey`, { method: 'POST' });
    if (!res.ok) {
      await sendFormattedMessage(ctx, '❌ Failed to generate API key.', getMainMenuKeyboard());
      return;
    }
    const data = (await res.json()) as { key?: string };
    if (!data.key) {
      await sendFormattedMessage(ctx, '❌ Invalid API key response.', getMainMenuKeyboard());
      return;
    }
    apiKey = data.key;
    await chatKeyStore.setApiKey(chatId, apiKey);
  }
  try {
    const chatRes = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
      headers: {
        'x-api-key': apiKey,
        'content-type': 'text/plain',
      },
      method: 'POST',
      body: "Give me a summary of the latest financial news and market updates that would be relevant for investors.",
    });
    if (!chatRes.ok) {
      console.error(chatRes.status, chatRes.statusText);
      sendFormattedMessage(ctx, '❌ Failed to fetch finance news', getMainMenuKeyboard());
      return;
    }
    const chatText = await chatRes.text();
    sendFormattedMessage(ctx, `💰 Latest Financial News:\n\n${chatText}`, getMainMenuKeyboard());
  } catch (error) {
    console.error('Error fetching finance news:', error);
    sendFormattedMessage(ctx, '❌ An error occurred while fetching finance news.', getMainMenuKeyboard());
  }
}

async function handleTechRequest(ctx: Context, argv: any, chatKeyStore: ChatKeyStore) {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) {
    await sendFormattedMessage(ctx, '❌ Unable to identify chat.', getMainMenuKeyboard());
    return;
  }
  let apiKey = await chatKeyStore.getApiKey(chatId);
  if (!apiKey) {
    const res = await fetch(`http://${argv.host}:${argv.port}/api/apikey`, { method: 'POST' });
    if (!res.ok) {
      await sendFormattedMessage(ctx, '❌ Failed to generate API key.', getMainMenuKeyboard());
      return;
    }
    const data = (await res.json()) as { key?: string };
    if (!data.key) {
      await sendFormattedMessage(ctx, '❌ Invalid API key response.', getMainMenuKeyboard());
      return;
    }
    apiKey = data.key;
    await chatKeyStore.setApiKey(chatId, apiKey);
  }
  try {
    const chatRes = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
      headers: {
        'x-api-key': apiKey,
        'content-type': 'text/plain',
      },
      method: 'POST',
      body: "Give me a summary of the latest technology news and developments in AI, software, and tech industry.",
    });
    if (!chatRes.ok) {
      console.error(chatRes.status, chatRes.statusText);
      sendFormattedMessage(ctx, '❌ Failed to fetch tech news', getMainMenuKeyboard());
      return;
    }
    const chatText = await chatRes.text();
    sendFormattedMessage(ctx, `💻 Latest Tech News:\n\n${chatText}`, getMainMenuKeyboard());
  } catch (error) {
    console.error('Error fetching tech news:', error);
    sendFormattedMessage(ctx, '❌ An error occurred while fetching tech news.', getMainMenuKeyboard());
  }
}

async function handleSearchRequest(ctx: Context, argv: any, query: string, chatKeyStore: ChatKeyStore) {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) {
    await sendFormattedMessage(ctx, '❌ Unable to identify chat.', getMainMenuKeyboard());
    return;
  }
  let apiKey = await chatKeyStore.getApiKey(chatId);
  if (!apiKey) {
    const res = await fetch(`http://${argv.host}:${argv.port}/api/apikey`, { method: 'POST' });
    if (!res.ok) {
      await sendFormattedMessage(ctx, '❌ Failed to generate API key.', getMainMenuKeyboard());
      return;
    }
    const data = (await res.json()) as { key?: string };
    if (!data.key) {
      await sendFormattedMessage(ctx, '❌ Invalid API key response.', getMainMenuKeyboard());
      return;
    }
    apiKey = data.key;
    await chatKeyStore.setApiKey(chatId, apiKey);
  }
  try {
    const chatRes = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
      headers: {
        'x-api-key': apiKey,
        'content-type': 'text/plain',
      },
      method: 'POST',
      body: `Search for information about: ${query}. Please provide a comprehensive summary.`,
    });
    if (!chatRes.ok) {
      console.error(chatRes.status, chatRes.statusText);
      sendFormattedMessage(ctx, '❌ Failed to perform search', getMainMenuKeyboard());
      return;
    }
    const searchText = await chatRes.text();
    sendFormattedMessage(ctx, `🔍 Search results for \"${query}\":\n\n${searchText}`, getMainMenuKeyboard());
  } catch (error) {
    console.error('Error performing search:', error);
    sendFormattedMessage(ctx, '❌ An error occurred while performing search.', getMainMenuKeyboard());
  }
}



main().catch(err => {
  console.error('Error in main:', err);
  process.exit(1);
});
