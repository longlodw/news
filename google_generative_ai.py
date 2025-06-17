from typing import List
from google import genai

def get_google_genai_client(
        api_key: str
) -> genai.Client:
    """
    Initializes and returns a Google Generative AI client.

    Args:
        api_key (str): The API key for the Google Generative AI service.

    Returns:
        genai.Client: An instance of the Google Generative AI client.
    """
    return genai.Client(api_key=api_key)

def generate_text(
        client: genai.Client,
        content: List[str],
) -> str:
    """
    Generates text using Google Generative AI.

    Args:
        client (genai.Client): The Google Generative AI client.
        content (List[str]): The content to be used for generating the answer.

    Returns:
        str: The generated answer.
    """
    response = client.models.generate_content(model='gemini-2.0-flash', contents=content)
    match response.text:
        case str() as answer:
            return answer
        case _:
            raise ValueError("Unexpected response format from Google Generative AI")

def get_embedding(
        client: genai.Client,
        texts: List[str]
) -> List[List[float]]:
    """
    Generates an embedding for the given text using Google Generative AI.

    Args:
        client (genai.Client): The Google Generative AI client.
        text (str): The text to be embedded.

    Returns:
        list: The generated embedding.
    """
    response = client.models.embed_content(model="text-embedding-004", contents=texts)
    match response.embeddings:
        case [_, *_] as embeddings:
            return [embedding.values for embedding in embeddings if embedding.values]
        case _:
            raise ValueError("Unexpected response format from Google Generative AI")
