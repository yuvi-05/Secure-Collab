import datetime

def utc_now():
    """Return timezone-aware current UTC datetime."""
    return datetime.datetime.now(datetime.timezone.utc)
