export const openapi = {
  "openapi": "3.1.0",
  "info": {
    "title": "Hono API Service",
    "version": "1.0.0",
    "description": "API service providing key generation, news processing, and chat via Gemini"
  },
  "paths": {
    "/api/apikey": {
      "post": {
        "summary": "Create API Key",
        "responses": {
          "200": {
            "description": "API key created",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "key": { "type": "string" }
                  }
                }
              }
            }
          },
          "500": { "description": "Server error" }
        }
      }
    },
    "/api/news": {
      "post": {
        "summary": "Submit news processing request",
        "parameters": [
          {
            "name": "x-api-key",
            "in": "header",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "News processed",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "filesCount": { "type": "integer" }
                  }
                }
              }
            }
          },
          "400": { "description": "Missing or invalid API key" },
          "401": { "description": "Unauthorized" },
          "500": { "description": "Server error" }
        }
      }
    },
    "/api/chat": {
      "post": {
        "summary": "Submit a chat message",
        "parameters": [
          {
            "name": "x-api-key",
            "in": "header",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "text/plain": {
              "schema": { "type": "string" }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Chat response",
            "content": {
              "text/plain": {
                "schema": { "type": "string" }
              }
            }
          },
          "400": { "description": "Invalid request or missing API key" },
          "401": { "description": "Unauthorized" },
          "500": { "description": "Server error" }
        }
      }
    }
  }
}
