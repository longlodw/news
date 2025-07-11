import { Context, Markup, Telegraf, Telegram } from 'telegraf';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';

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

async function main() {
  // Parse command line arguments
  const argv = await yargs(hideBin(process.argv))
    .option('token', {
      alias: 't',
      type: 'string',
      description: 'Telegram Bot Token',
      demandOption: true,
    })
    .option('id', {
      alias: 'i',
      type: 'string',
      description: 'Telegram Bot ID',
      demandOption: true,
    })
    .option('apikey', {
      alias: 'a',
      type: 'string',
      description: 'API Key for chat service',
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
    .parse();

  if (!argv.token || !argv.id || !argv.apikey) {
    console.error('Error: --token, --id, and --apikey are required');
    process.exit(1);
  }
  const bot = new Telegraf(argv.token);

  bot.start((ctx: Context) => ctx.reply(formatMarkdown('Welcome!'), { parse_mode: 'MarkdownV2' }));
  bot.help((ctx: Context) => ctx.reply(formatMarkdown(`
Available commands:
/start - Start the bot
/help - Show this help message
/news - Get the latest news summary
    `), { parse_mode: 'MarkdownV2' }));

  bot.command('news', async (ctx: Context) => {
    try {
      const resNews = await fetch(`http://${argv.host}:${argv.port}/api/news`, {
        headers: {
          'x-api-key': argv.apikey,
        },
        method: 'POST',
      });
      if (!resNews.ok) {
        console.error(resNews.statusText)
        ctx.reply(formatMarkdown('Failed to fetch news'), { parse_mode: 'MarkdownV2' });
        return;
      }
      const chatRes = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
        headers: {
          'x-api-key': argv.apikey,
          'content-type': 'text/plain',
        },
        method: 'POST',
        body: "give me a summary of the latest news",
      });
      if (!chatRes.ok) {
        console.error(chatRes.status, chatRes.statusText)
        ctx.reply(formatMarkdown('Failed to summarize news'), { parse_mode: 'MarkdownV2' });
        return;
      }
      const chatText = await chatRes.text();
      ctx.reply(formatMarkdown(`Latest News Summary:\n${chatText}`), { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error fetching news:', error);
      ctx.reply(formatMarkdown('An error occurred while fetching news.'), { parse_mode: 'MarkdownV2' });
    }
  });

  bot.on('text', async (ctx: Context) => {
    const res = await fetch(`http://${argv.host}:${argv.port}/api/chat`, {
      headers: {
        'Content-Type': 'text/plain',
        'x-api-key': argv.apikey,
      },
      method: 'POST',
      body: ctx.text,
    });
    const responseText = await res.text();
    ctx.reply(formatMarkdown(responseText), { parse_mode: 'MarkdownV2' });
  });
  await bot.launch().then(() => {
    console.log('Bot is running...');
  }).catch(err => {
    console.error('Failed to start the bot:', err);
  });
}

main().catch(err => {
  console.error('Error in main:', err);
  process.exit(1);
});
