import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, limit: int, window: float, name: str):
        self.limit, self.window, self.name = limit, window, name
        self.hits: dict[str, deque] = defaultdict(deque)

    def reset(self) -> None:
        self.hits.clear()

    def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        q = self.hits[ip]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(429, "Too many requests, slow down")
        q.append(now)
        if len(self.hits) > 5000:  # cheap pruning of idle IPs
            for k in [k for k, v in self.hits.items() if not v or now - v[-1] > self.window]:
                del self.hits[k]


public_limiter = RateLimiter(60, 60, "public")
login_limiter = RateLimiter(10, 15 * 60, "login")
