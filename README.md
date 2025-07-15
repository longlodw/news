# Telegram News & AI Chat Bot

This project consists of a Telegram bot and an API server.
The bot delivers news summaries, finance and tech updates, and enables users to chat with an AI assistant powered by Google's Gemini API.
The API server manages chat requests and API keys.

## Features

- Telegram bot with inline buttons for news, finance, tech, and search
- AI-powered chat using Gemini
- Secure API key management per chat
- REST API endpoints for chat and API key creation
- OpenAPI documentation at `/docs` and Swagger UI at `/docs/swagger`

## Getting Started

Install dependencies:

```
npm install
```

Start the API server:

```
npm run dev-server
```

Open API docs:

```
open http://localhost:3000/docs/swagger
```

Start the Telegram bot:

```
npm run dev-bot -- --token <TELEGRAM_BOT_TOKEN> --sqlite-path ./data/chatkeys.db --host localhost --port 3000
```

## Configuration

- `--token`: Telegram Bot Token (required for bot)
- `--sqlite-path`: Path to SQLite file for chat id to API key mapping (required for bot)
- `--host`: Host for chat service (default: localhost)
- `--port`: Port for chat service (default: 3000)
- `--gemini-key`: Gemini API key (required for API server)
- `--storage-path`: Path to store API server data (default: ./data)

## Usage

- Use Telegram commands or inline buttons to interact with the bot.
- Chat with the AI assistant by sending any text message.
- Search for information using `/search <query>` or category buttons.

## API Endpoints

- `POST /api/apikey`: Create a new API key
- `POST /api/chat`: Chat with the AI (requires `x-api-key` header)
- `GET /docs`: OpenAPI spec
- `GET /docs/swagger`: Swagger UI


