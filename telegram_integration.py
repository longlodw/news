from typing import Callable
import telebot
from telebot.util import smart_split

AnswerQuestion = Callable[[str], str]
IngestNews = Callable[[], str]

def get_telegram_bot(token: str) -> telebot.TeleBot:
    """
    Initialize and return a Telegram bot instance.

    :param token: The token for the Telegram bot.
    :return: An instance of telebot.TeleBot.
    """
    return telebot.TeleBot(token)

def welcome(bot: telebot.TeleBot, message: telebot.types.Message):
    """
    Send a welcome message when the bot receives the /start command.

    :param bot: The Telegram bot instance.
    :param message: The message object containing the command.
    """
    bot.reply_to(message, "Welcome. Give my any topic and I will give you informatin on it. I will periodically send you some interesting pieces of news.")

def answer_query(answer_question: AnswerQuestion, bot: telebot.TeleBot, message: telebot.types.Message):
    """
    Handle the user's query and respond with relevant information.

    :param bot: The Telegram bot instance.
    :param message: The message object containing the user's query.
    :param query: The query string to process.
    """
    query = message.text
    if not query:
        bot.reply_to(message, "Please provide a valid query.")
        return
    bot.reply_to(message, answer_question(query))

def send_news(ingest_news: IngestNews, chat_id: str | int, bot: telebot.TeleBot):
    """
    Periodically send interesting news to the Telegram channel.

    :param bot: The Telegram bot instance.
    """
    news = ingest_news()
    split_news = smart_split(news)  # Telegram message limit is 4096 characters
    for part in split_news:
        bot.send_message(chat_id=chat_id, text=part)
