import datetime
from functools import partial
import os
import uvicorn
import base64
from fastapi import Body, FastAPI, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
import argparse
import uuid
import hashlib

from google_generative_ai import get_google_genai_client
import google_generative_ai
import local_content_store
from news_actions import answer_question, ingest_news
from newsapi_fetching import get_newsapi_client
import newsapi_fetching
from storage import init_api_keys_db, init_chat_db, init_document_db, load_api_key, store_api_key

def main():
    parser = argparse.ArgumentParser(description="Start the FastAPI server for news ingestion and chat storage.")
    parser.add_argument("-P", "--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("-H", "--host", type=str, default='localhost', help="Host to run the server on")
    parser.add_argument("-N", "--news-api-key", type=str, required=True, help="API key for the news service")
    parser.add_argument("-G", "--gemini-api-key", type=str, required=True, help="API key for the Gemini service")
    parser.add_argument("-S", "--storage", type=str, default="./.store", help="Storage directory for chat and document data")
    parser.add_argument("-A", "--api-keys", type=str, default="./apis.db", help="Storage file for API keys")
    args = parser.parse_args()
    news_api_client = get_newsapi_client(args.news_api_key)
    get_latest_news = lambda from_time, query: newsapi_fetching.get_latest_news(news_api_client, from_time, query)
    google_genai_client = get_google_genai_client(args.gemini_api_key)
    get_embedding = lambda texts: google_generative_ai.get_embedding(google_genai_client, texts)
    generate_text = lambda content: google_generative_ai.generate_text(google_genai_client, content)

    args = parser.parse_args()
    app = FastAPI()
    api_key_header = APIKeyHeader(name="X-News-API-Key", auto_error=False)
    @app.post("/api/apikey")
    def _():
        """
        Endpoint to create a new API key for the news service.
        """
        api_db = init_api_keys_db(args.api_keys)
        api_key = uuid.uuid4().bytes
        sha256_api_key = hashlib.sha256(api_key).hexdigest()
        data_location = os.path.join(args.storage, sha256_api_key)
        try:
            os.makedirs(data_location)
            store_api_key(api_db, sha256_api_key, data_location)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create API key: {str(e)}")
        finally:
            api_db.close()
        return {"status": "success", "api_key": base64.b64encode(api_key).decode()}

    @app.post("/api/ingest")
    def _(from_time: str | None = None, api_key: str = Security(api_key_header)):
        """
        Endpoint to trigger the ingestion of news articles.
        """
        api_db = init_api_keys_db(args.api_keys)
        sha256_api_key = hashlib.sha256(base64.b64decode(api_key)).hexdigest()
        try:
            location = load_api_key(api_db, sha256_api_key)
        except Exception:
            raise HTTPException(status_code=401, detail=f"Invalid API key with hash {sha256_api_key}")
        finally:
            api_db.close()
        if from_time is None or from_time == "":
            from_time = (datetime.datetime.now() - datetime.timedelta(days=1)).isoformat()
        with init_document_db(os.path.join(location, "documents.db")) as document_db, init_chat_db(os.path.join(location, "chat.db")) as chat_db:
            try:
                store_content = partial(local_content_store.store_content, base_path=location)
                
                # Process and store the news articles as needed
                return {"status": "success", "message": ingest_news(
                    get_latest_news=get_latest_news,
                    get_embedding=get_embedding,
                    document_db=document_db,
                    chat_db=chat_db,
                    store_content=store_content,
                    generate_text=generate_text,
                    from_time=from_time
                )}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to ingest news: {str(e)}")

    @app.post("/api/chat")
    async def _(body: str = Body(media_type="text/plain"), api_key: str = Security(api_key_header)):
        """
        Endpoint to handle chat messages.
        """
        # Check if header content type is text/plain
        api_db = init_api_keys_db(args.api_keys)
        sha256_api_key = hashlib.sha256(base64.b64decode(api_key)).hexdigest()
        try:
            location = load_api_key(api_db, sha256_api_key)
        except Exception:
            raise HTTPException(status_code=401, detail=f"Invalid API key with hash {sha256_api_key}")
        finally:
            api_db.close()
        with init_document_db(os.path.join(location, "documents.db")) as document_db, init_chat_db(os.path.join(location, "chat.db")) as chat_db:
            try:
                return {"status": "success", "message": answer_question(
                    get_embedding=get_embedding,
                    document_db=document_db,
                    chat_db=chat_db,
                    load_content=local_content_store.load_content,
                    generate_text=generate_text,
                    question=body
                )}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to process chat message: {str(e)}")

    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
