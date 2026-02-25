import requests

def fetch_reddit_data():
    data = requests.get(
        "https://www.reddit.com/r/teenarazzi/about.json",
        headers={"User-Agent": "my_app"},
        verify=False
    )

    output = [data["data"]["subscribers"], data["data"]["active_user_count"]]
    return output