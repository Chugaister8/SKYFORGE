"""
Application metrics — Prometheus-compatible /api/metrics endpoint.
Tracks: HTTP requests, active WS connections, active rooms,
        DB query count, Redis operations, simulation steps.
"""
import time
import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from typing import DefaultDict

# ── Counters (thread-safe-ish — asyncio single thread) ────────────

@dataclass
class Metrics:
    # HTTP
    http_requests_total:     DefaultDict[str, int] = field(default_factory=lambda: defaultdict(int))
    http_errors_total:       DefaultDict[str, int] = field(default_factory=lambda: defaultdict(int))
    http_duration_sum:       DefaultDict[str, float] = field(default_factory=lambda: defaultdict(float))

    # WebSocket
    ws_connections_active:   int = 0
    ws_messages_total:       int = 0

    # Simulator
    sim_steps_total:         int = 0
    sim_ws_connections:      int = 0

    # Rooms
    rooms_active:            int = 0
    rooms_total_created:     int = 0

    # Training
    quizzes_completed:       int = 0
    certs_issued:            int = 0

    # System
    started_at:              float = field(default_factory=time.time)


_metrics = Metrics()


def get_metrics() -> Metrics:
    return _metrics


# ── Mutators ──────────────────────────────────────────────────────

def record_request(method: str, path: str, status: int, duration_ms: float) -> None:
    key = f"{method}_{path.split('?')[0].replace('/','_').strip('_')}"
    _metrics.http_requests_total[key] += 1
    _metrics.http_duration_sum[key]   += duration_ms
    if status >= 400:
        _metrics.http_errors_total[key] += 1


def inc_ws_connection(delta: int = 1) -> None:
    _metrics.ws_connections_active = max(0, _metrics.ws_connections_active + delta)


def inc_sim_step() -> None:
    _metrics.sim_steps_total += 1


def inc_sim_ws(delta: int = 1) -> None:
    _metrics.sim_ws_connections = max(0, _metrics.sim_ws_connections + delta)


def set_active_rooms(n: int) -> None:
    _metrics.rooms_active = n


def inc_rooms_created() -> None:
    _metrics.rooms_total_created += 1


def inc_quiz_completed() -> None:
    _metrics.quizzes_completed += 1


def inc_cert_issued() -> None:
    _metrics.certs_issued += 1


# ── Prometheus text format renderer ──────────────────────────────

def render_prometheus() -> str:
    m    = _metrics
    now  = time.time()
    uptime = now - m.started_at
    lines: list[str] = []

    def gauge(name: str, value: float, help_text: str = "", labels: str = "") -> None:
        if help_text:
            lines.append(f"# HELP {name} {help_text}")
            lines.append(f"# TYPE {name} gauge")
        lbl = f"{{{labels}}}" if labels else ""
        lines.append(f"{name}{lbl} {value:.1f}")

    def counter(name: str, value: int, help_text: str = "") -> None:
        if help_text:
            lines.append(f"# HELP {name} {help_text}")
            lines.append(f"# TYPE {name} counter")
        lines.append(f"{name}_total {value}")

    gauge("skyforge_uptime_seconds",    uptime,                   "Application uptime in seconds")
    gauge("skyforge_ws_connections",    m.ws_connections_active,  "Active WebSocket telemetry connections")
    gauge("skyforge_sim_ws_connections",m.sim_ws_connections,     "Active simulator WebSocket sessions")
    gauge("skyforge_rooms_active",      m.rooms_active,           "Active multiplayer rooms")

    counter("skyforge_sim_steps",       m.sim_steps_total,        "Total simulator physics steps")
    counter("skyforge_rooms_created",   m.rooms_total_created,    "Total rooms created")
    counter("skyforge_quizzes_completed",m.quizzes_completed,     "Total quiz completions")
    counter("skyforge_certs_issued",    m.certs_issued,           "Total certificates issued")
    counter("skyforge_ws_messages",     m.ws_messages_total,      "Total WebSocket messages")

    # HTTP per-route
    lines.append("# HELP skyforge_http_requests_total Total HTTP requests")
    lines.append("# TYPE skyforge_http_requests_total counter")
    for route, count in sorted(m.http_requests_total.items()):
        lines.append(f'skyforge_http_requests_total{{route="{route}"}} {count}')

    lines.append("# HELP skyforge_http_errors_total Total HTTP 4xx/5xx responses")
    lines.append("# TYPE skyforge_http_errors_total counter")
    for route, count in sorted(m.http_errors_total.items()):
        lines.append(f'skyforge_http_errors_total{{route="{route}"}} {count}')

    lines.append("# HELP skyforge_http_duration_ms_sum Total HTTP response time (ms)")
    lines.append("# TYPE skyforge_http_duration_ms_sum counter")
    for route, total in sorted(m.http_duration_sum.items()):
        lines.append(f'skyforge_http_duration_ms_sum{{route="{route}"}} {total:.1f}')

    return "\n".join(lines) + "\n"
