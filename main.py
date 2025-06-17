import telebot
from newsapi import NewsApiClient

tg_token = 'TELEGRAM_BOT_TOKEN'

newsapi_key = 'NEWS_API_KEY'

bot = telebot.TeleBot(tg_token)
newsapi = NewsApiClient(api_key=newsapi_key)


def get_top_news(country):
    try:
        top_headlines = newsapi.get_top_headlines(country=country, page_size=5)
        articles = top_headlines.get('articles', [])
        if not articles:
            return ["No news articles found for this country"]

        news_list = []
        for article in articles:
            title = article.get('title', "No title")
            url = article.get('url', '')
            news_list.append(f"{title}\n{url}\n")

        return news_list
    except Exception as e:
        return [f"An error occured{str(e)}"]


@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, "Welcome. Send me a country code and I will find news for it.")


@bot.message_handler(func=lambda message: True)
def handle_message(message):
    country_code = message.text.strip().lower()
    news = get_top_news(country_code)
    bot.reply_to(message, "\n".join(news))


bot.polling(none_stop=True)
