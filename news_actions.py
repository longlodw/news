import sqlite3
from typing import Dict, List, Callable

from func_iter import apply
from storage import LoadContent, StoreContent, User, load_chat_messages, store_chat_message
import storage

GetLatestNews = Callable[[str, str], list[Dict[str, str]]]
GetEmbedding = Callable[[List[str]], List[List[float]]]
GenerateText = Callable[[List[str]], str]

def chunk_text(text: str, chunk_size: int = 1024) -> List[str]:
    """
    Splits the input text into chunks of specified size until end of sentence.

    Args:
        text (str): The text to be chunked.
        chunk_size (int): The maximum size of each chunk.

    Returns:
        List[str]: A list of text chunks.
    """
    # Split the text into sentences delimited by . or ! or ? or newline
    sentences = text.split(r'[.!?]\s+|\n')
    chunks = []
    current_chunk = []
    for sentence in sentences:
        if len(current_chunk) + len(sentence) + 1 <= chunk_size:
            current_chunk.append(sentence)
        else:
            if current_chunk:
                chunks.append('\n'.join(current_chunk))
            current_chunk = [sentence]
    if current_chunk:
        chunks.append('\n'.join(current_chunk))
    return chunks

def ingest_news(
    get_latest_news: GetLatestNews,
    get_embedding: GetEmbedding,
    document_db: sqlite3.Connection,
    chat_db: sqlite3.Connection,
    store_content: StoreContent,
    generate_text: GenerateText,
    from_time: str,
) -> str:
    """
    Ingests the latest news articles, generates embeddings, and stores them in the database.
    
    Args:
        get_latest_news (GetLatestNews): Function to fetch the latest news articles.
        get_embedding (GetEmbedding): Function to generate embeddings for text.
        db (sqlite3.Connection): Database connection object.
        generate_answer (GenerateAnswer): Function to generate an answer from the ingested content.
    
    Returns:
        str: A confirmation message indicating successful ingestion.
    """
    print(f"'{User.ASKER}'")
    old_messages = load_chat_messages(chat_db)
    old_messages_contents = list(apply(old_messages, lambda x: f"{x[0]}: {x[1]}"))
    if len(old_messages_contents) > 0:
        old_messages_contents.append(f"what is the most probable topic of interest to {User.ASKER} based on recent chat messages in 1 phrase?")
        interests = generate_text(old_messages_contents)
    else:
        interests = "general news"
    latest_news = get_latest_news(from_time, interests)
    if len(latest_news) == 0:
        return "No articles found for the specified time and interests."
    for article in latest_news:
        match article:
            case {'title': title, 'url': url, 'content': content}:
                # Chunk the article content
                chunks = chunk_text(content)
                # Generate embeddings for each chunk
                embeddings = get_embedding(chunks)
                # Store the document and its chunks in the database
                storage.store_document(document_db, store_content, title, url, list(zip(chunks, embeddings)))
            case _:
                continue  # Skip articles that do not match the expected format
    msg = generate_text(list(apply(latest_news, lambda x: f"{x['title']}: {x['content']}")) + [f"summarize the information from the news and highlight the most important points"])
    store_chat_message(chat_db, User.BROADCASTER, msg)
    return msg

def answer_question(
    get_embedding: GetEmbedding,
    document_db: sqlite3.Connection,
    chat_db: sqlite3.Connection,
    load_content: LoadContent,
    generate_text: GenerateText,
    question: str
) -> str:
    """
    Answers a question based on the stored news articles and their embeddings.
    
    Args:
        get_embedding (GetEmbedding): Function to generate embeddings for the question.
        document_db (sqlite3.Connection): Database connection for the documents.
        chat_db (sqlite3.Connection): Database connection for the chat messages.
        load_content (LoadContent): Function to load content from the database.
        generate_answer (GenerateAnswer): Function to generate an answer from the ingested content.
        question (str): The question to be answered.
    
    Returns:
        str: The generated answer to the question.
    """
    embedding = get_embedding([question])[0]
    documents = storage.load_documents(document_db, load_content, embedding)
    contents = list(apply(documents, lambda x: f"title: {x[0]}\nurl: {x[1]}\ncontent: {x[2]}"))
    store_chat_message(chat_db, User.ASKER, question)
    old_messages = load_chat_messages(chat_db)
    explicit_question = generate_text(list(apply(old_messages, lambda x: f"{x[0]}: {x[1]}")) + [f"what does '{question}' mean?"])
    contents.append(explicit_question)
    return generate_text(contents)
