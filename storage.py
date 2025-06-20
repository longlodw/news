from enum import Enum
import sqlite3
from typing import Callable, List, Tuple
import sqlite_vec

from func_iter import apply

StoreContent = Callable[[str], str]
LoadContent = Callable[[str], str]

class User(Enum):
    ASKER = "asker"
    ANSWERER = "answerer"
    BROADCASTER = "broadcaster"

def init_chat_db(db_path: str) -> sqlite3.Connection:
    """
    Initialize the SQLite database for chat storage.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table for chat messages
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

def store_chat_message(db: sqlite3.Connection, user: User, message: str):
    """
    Add a chat message to the database.
    """
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO chat_messages (user, message)
        VALUES (?, ?)
    ''', (str(user.value), message))
    db.commit()

def load_chat_messages(db: sqlite3.Connection) -> List[Tuple[str, str]]:
    """
    Load all chat messages from the database.
    """
    cursor = db.cursor()
    cursor.execute('SELECT user, message FROM chat_messages')
    return cursor.fetchall()

def init_document_db(db_path: str) -> sqlite3.Connection:
    """
    Initialize the SQLite database for document storage.
    """
    conn = sqlite3.connect(db_path)
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)
    cursor = conn.cursor()
    
    cursor.execute('PRAGMA foreign_keys = ON')
    # Create table for documents
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING vec0(
            location TEXT NOT NULL UNIQUE,
            document_id INTEGER NOT NULL,
            embedding FLOAT[768],
        )
    ''')
    conn.commit()
    return conn

def store_document(db: sqlite3.Connection, store_content: StoreContent, title: str, url: str, contents: List[Tuple[str, List[float]]]):
    """
    Store a document and its chunks in the database.
    """
    cursor = db.cursor()
    cursor.execute('BEGIN TRANSACTION')
    try:
        # Insert document
        cursor.execute('INSERT INTO documents (title, url) VALUES (?, ?)', (title, url))
        document_id = cursor.lastrowid
        
        # Insert chunks
        cursor.executemany('''
            INSERT INTO chunks (location, document_id, embedding)
            VALUES (?, ?, ?)
        ''', apply(contents, lambda content: (store_content(content[0]), document_id, sqlite_vec.serialize_float32(content[1]))))
        db.commit()
    except Exception as e:
        db.rollback()
        raise e

def load_documents(db: sqlite3.Connection, load_content: LoadContent, query_embedding: List[float], thresh: float = 0.3, limit: int = 32) -> List[Tuple[str, str, str, float]]:
    """
    Load documents based on a query embedding.
    """
    cursor = db.cursor()
    cursor.execute('''
        SELECT d.title, d.url, c.location, vec_distance_cosine(c.embedding, ?) as score
        FROM documents d
        JOIN chunks c ON d.id = c.document_id
        WHERE score <= ?
        ORDER BY score DESC
        LIMIT ?
    ''', (sqlite_vec.serialize_float32(query_embedding), thresh, limit))
    
    return list(apply(cursor.fetchall(), lambda row: (row[0], row[1], load_content(row[2]), row[3])))

def init_api_keys_db(db_path: str) -> sqlite3.Connection:
    """
    Initialize the SQLite database for API keys.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table for API keys
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            key TEXT NOT NULL UNIQUE PRIMARY KEY,
            data_location TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

def store_api_key(db: sqlite3.Connection, key: str, data_location: str):
    """
    Store an API key and its associated data location in the database.
    """
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO api_keys (key, data_location)
        VALUES (?, ?)
    ''', (key, data_location))
    db.commit()

def load_api_key(db: sqlite3.Connection, key: str) -> str:
    """
    Load an API key and its associated data location from the database.
    
    Args:
        db (sqlite3.Connection): Database connection object.
        key (str): The API key to load.
    
    Returns:
        str: The data location associated with the API key.
    """
    cursor = db.cursor()
    cursor.execute('SELECT data_location FROM api_keys WHERE key = ?', (key,))
    result = cursor.fetchone()
    if result:
        return result[0]
    else:
        raise ValueError("API Key not found")

