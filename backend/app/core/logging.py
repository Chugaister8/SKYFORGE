"""
Structured logging setup for SKYFORGE.
- JSON output in production, pretty in development
- Request ID propagation via contextvars
- Response time logging
"""
import uuid
import time
import structlog
import logging
from contextvars import ContextVar
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from app.core.config import get_settings

settings = get_settings()

# Context variable for request ID (available throughout request lifecycle)
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")

# ── structlog configuration ───────────────────────────────────────

def configure_logging() -> None:
    """Configure structlog + standard logging."""
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.is_production:
        # JSON output for log aggregators (Loki, CloudWatch, etc.)
        renderer = structlog.processors.JSONRenderer()
    else:
        # Colorful console output for development
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.debug else logging.INFO
        ),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


# ── Request logging middleware ────────────────────────────────────

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Injects request_id into structlog context.
    Logs: method, path, status, duration_ms.
    Skips /api/health to reduce noise.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Generate or inherit request ID
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        request_id_ctx.set(req_id)

        # Bind to structlog context for this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=req_id,
            method=request.method,
            path=request.url.path,
        )

        start = time.perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)

            # Skip health check noise
            if request.url.path not in ("/api/health",):
                logger = structlog.get_logger("http")
                log_fn = logger.info if status_code < 400 else logger.warning
                if status_code >= 500:
                    log_fn = logger.error

                log_fn(
                    "http.request",
                    status=status_code,
                    duration_ms=duration_ms,
                    client=request.client.host if request.client else "unknown",
                )

        # Inject request ID into response headers
        response.headers["X-Request-ID"] = req_id
        return response


def get_request_id() -> str:
    """Get current request ID from context."""
    return request_id_ctx.get("")
