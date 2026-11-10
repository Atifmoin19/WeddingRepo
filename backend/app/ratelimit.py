import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


def now() -> float:
    return time.monotonic()


class RateLimiter:
    """Sliding window, in memory. Used per IP as a dependency, or per any key with blocked()/add()."""

    def __init__(self, limit: int, window: float, name: str):
        self.limit, self.window, self.name = limit, window, name
        self.hits: dict[str, deque] = defaultdict(deque)

    def reset(self) -> None:
        self.hits.clear()

    def blocked(self, key: str) -> bool:
        q = self.hits.get(key)
        if not q:
            return False
        t = now()
        while q and t - q[0] > self.window:
            q.popleft()
        return len(q) >= self.limit

    def add(self, key: str) -> None:
        t = now()
        self.hits[key].append(t)
        if len(self.hits) > 5000:  # cheap pruning of idle keys
            for k in [k for k, v in self.hits.items() if not v or t - v[-1] > self.window]:
                del self.hits[k]

    def __call__(self, request: Request) -> None:
        ip = client_ip(request)
        if self.blocked(ip):
            raise HTTPException(429, "Too many requests, slow down")
        self.add(ip)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


public_limiter = RateLimiter(60, 60, "public")
login_limiter = RateLimiter(10, 15 * 60, "login")
# OTP: asking for a code is limited per email and per IP, checking one per IP.
otp_email_minute = RateLimiter(1, 60, "otp-email-minute")
otp_email_hour = RateLimiter(5, 60 * 60, "otp-email-hour")
otp_ip_hour = RateLimiter(10, 60 * 60, "otp-ip-hour")
otp_verify_limiter = RateLimiter(30, 15 * 60, "otp-verify")
ALL_LIMITERS = [public_limiter, login_limiter, otp_email_minute, otp_email_hour, otp_ip_hour,
                otp_verify_limiter]
