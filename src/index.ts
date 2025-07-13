import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ApiKeyClient } from './apikey.js';
import { ApiKeyHandler } from './ApiKeyHandler.js';
import { ChatClient } from './chat.js';
import { GeminiClient } from './gemini.js';
import { ChatHandler } from './ChatHandler.js';
import { swaggerUI } from '@hono/swagger-ui';
import { openapi } from './openapi.js'; // Import OpenAPI spec
import fs from 'fs';
import { resolve } from 'path';

async function main() {
  // Parse command line arguments
  const argv = await yargs(hideBin(process.argv))
    .option('port', {
      alias: 'P',
      type: 'number',
      description: 'Port to run the server on',
      default: 3000,
    })
    .option('host', {
      alias: 'H',
      type: 'string',
      description: 'Host to run the server on',
      default: 'localhost',
    })
    .option('gemini-key', {
      alias: 'g',
      type: 'string',
      description: 'Gemini API key',
      requiresArg: true,
    })
    .option('storage-path', {
      alias: 's',
      type: 'string',
      description: 'Path to store data',
      default: './data',
    }).parse();
  if (!argv.storagePath) {
    console.error('Error: --storage-path is required');
    process.exit(1);
  }
  if (!fs.existsSync(argv.storagePath)) {
    fs.mkdirSync(argv.storagePath, { recursive: true });
    console.log(`Created storage directory at ${argv.storagePath}`);
  }
  const storagePath = resolve(argv.storagePath);
  const apiKeyClient = await ApiKeyClient.create(`file:${storagePath}/apikeys.db`);
  if (!argv.newsdataKey) {
    console.error('Error: --newsdata-key is required');
    process.exit(1);
  }
  if (!argv.geminiKey) {
    console.error('Error: --gemini-key is required');
    process.exit(1);
  }
  const geminiClient = new GeminiClient(argv.geminiKey);
  const apiKeyHandler = new ApiKeyHandler(storagePath, apiKeyClient);

  const app = new Hono()

  app.post('/api/apikey', async (c) => {
    try {
      return c.json({ key: await apiKeyHandler.post() });
    }
    catch (error) {
      console.error('Error creating API key:', error);
      return c.json({ error: 'Failed to create API key' }, 500);
    }
  })

  app.post('/api/chat', async (c) => {
    try {
      const apikey = c.req.header('x-api-key');
      if (!apikey) {
        return c.json({ error: 'API key is required' }, 400);
      }
      const apiKeyObject = await apiKeyClient.load(apikey);
      if (!apiKeyObject) {
        return c.json({ error: 'Invalid API key' }, 401);
      }
      const chatRequest = await c.req.text();
      if (!chatRequest) {
        return c.json({ error: 'Invalid chat request format' }, 400);
      }
      const chatClient = await ChatClient.create(`file:${apiKeyObject.url}/chats.db`);
      const chatHandler = new ChatHandler(chatClient, geminiClient);
      const response = await chatHandler.post(chatRequest);
      return c.text(response);
    } catch (error) {
      console.error('Error processing chat request:', error);
      return c.json({ error: 'Failed to process chat request' }, 500);
    }
  });

  app.get('/docs', (c) => c.json(openapi, 200));

  app.get('/docs/swagger', swaggerUI({ url: '/docs' }));

  serve({
    fetch: app.fetch,
    hostname: argv.host,
    port: argv.port,
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  });
}

main().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
