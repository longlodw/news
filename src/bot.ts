import { Context, Markup, Telegraf, Telegram } from 'telegraf';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';

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

  bot.start((ctx: Context) => ctx.reply('Welcome!'));
  bot.help((ctx: Context) => ctx.reply(`
    Available commands:
    /start - Start the bot
    /help - Show this help message
    /news - Get the latest news summary
    `));

  bot.command('news', async (ctx: Context) => {
    try {
      const resNews = await fetch(`http://${argv.host}:${argv.port}/api/news`, {
        headers: {
          'x-api-key': argv.apikey,
        },
        method: 'POST',
      });
      if (!resNews.ok) {
        ctx.reply('Failed to fetch news');
        return;
      }
      const chatRes = await fetch(`http://${argv.host}:${argv.port}/api/news/chat`, {
        headers: {
          'x-api-key': argv.apikey,
          'content-type': 'text/plain',
        },
        method: 'POST',
        body: "give me a summary of the latest news",
      });
      if (!chatRes.ok) {
        ctx.reply('Failed to summarize news');
        return;
      }
      const chatText = await chatRes.text();
      console.log('Chat response:', chatText);
      ctx.reply(`Latest News Summary:\n${chatText}`);
    } catch (error) {
      console.error('Error fetching news:', error);
      ctx.reply('An error occurred while fetching news.');
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
    ctx.reply(`${await res.text()}`);
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
