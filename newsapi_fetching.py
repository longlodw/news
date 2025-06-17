from typing import Dict, List
import newsapi

def get_newsapi_client(api_key: str) -> newsapi.NewsApiClient:
    """
    Initialize and return a NewsAPI client with the provided API key.
    
    :param api_key: Your NewsAPI API key.
    :return: An instance of the NewsAPI client.
    """
    return newsapi.NewsApiClient(api_key=api_key)

def get_latest_news(
        client: newsapi.NewsApiClient,
        from_time: str,
        query: str
) -> List[Dict[str, str]]:
    """
    Fetch the latest news articles using the NewsAPI client.
    
    :param client: An instance of the NewsAPI client.
    :return: A list of dictionaries containing news articles.
    """
    response = client.get_everything(language='en', page_size=32, 
                                      from_param=from_time,
                                      q=query, sort_by='relevancy')
    match response:
        case {'status': 'ok', 'articles': articles}:
            return articles
        case {'status': 'error', 'message': message}:
            raise ValueError(f"Error fetching news: {message}")
        case _:
            raise ValueError("Unexpected response format from NewsAPI")
