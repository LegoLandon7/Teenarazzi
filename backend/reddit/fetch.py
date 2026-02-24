import praw
from dotenv import load_dotenv
import os

load_dotenv()

client = praw.Reddit(
    client_id=os.getenv("REDDIT_CLIENT_ID"),
    client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
    user_agent="my_app/1.0"
)

subreddit = client.subreddit("teenarazzi")

def fetch_reddit_data():
    data = [subreddit.subscribers, subreddit.accounts_active]
    return data