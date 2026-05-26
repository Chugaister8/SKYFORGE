"""
WebSocket simulator endpoint — replaces HTTP polling at 20Hz.
Client connects once, sends control frames, receives physics state.

Protocol:
  Client → Server: {"type":"auth","token":"..."}         (first message)
  Client → Server: {"type":"step","control":{...},"ew":{...},"wind":{...}}
  Client → Server: {"type":"ping"}
  Server → Client: {"type":"connected"}
  Server → Client: {"type":"state","state":{...},"diagnostics":{...}}
  Server → Client: {"type":"pong"}
  Server → Client: {"type":"error","msg":"..."}
"""
import json
import asyncio
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.security import decode_token
from app.core.config import get_settings
from app.api.simulation import EWInfluence, _apply_ew_to_control, _apply_ew_to_state
from app.simulation.physics.base import PhysicsState, ControlInput

logger   = structlog.get_logger()
router   = APIRouter()
settings = get_settings()


async def _authenticate(ws: WebSocket) -> str | None:
    """Auth via first message. Returns user_id or None."""
    await ws.accept()
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=10.0)
        msg = json.loads(raw)
        if msg.get("type") != "auth":
            await ws.send_text(json.dumps({"type":"error","msg":"First message must be auth"}))
            await ws.close(code=4001)
            return None
        payload = decode_token(msg.get("token",""))
        if payload.get("type") != "access":
            await ws.close(code=4001)
            return None
        return payload["sub"]
    except Exception:
        try: await ws.close(code=4001)
        except Exception: pass
        return None


@router.websocket("/ws/simulator")
async def simulator_ws(ws: WebSocket):
    """
    Stateful simulator session over WebSocket.
    Maintains physics state server-side between steps.
    """
    user_id = await _authenticate(ws)
    if not user_id:
        return

    await ws.send_text(json.dumps({"type": "connected", "user_id": user_id}))
    logger.info("ws.simulator.connected", user_id=user_id)

    # Session state
    state     = PhysicsState()
    library_id = "mavic-3t"
    dt         = 0.05
    physics    = None

    # Heartbeat
    async def heartbeat():
        while True:
            await asyncio.sleep(settings.ws_heartbeat_s)
            try:
                await ws.send_text(json.dumps({"type":"ping"}))
            except Exception:
                break

    hb_task = asyncio.create_task(heartbeat())

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            match msg.get("type",""):
                case "ping":
                    await ws.send_text(json.dumps({"type":"pong"}))

                case "pong":
                    pass

                case "init":
                    # Client sends library_id + optional initial state
                    library_id = msg.get("library_id", "mavic-3t")
                    physics    = None  # will be (re)created on next step
                    init_state = msg.get("state", {})
                    if init_state:
                        valid_keys = PhysicsState.__dataclass_fields__.keys()
                        state = PhysicsState(**{k:v for k,v in init_state.items() if k in valid_keys})
                    await ws.send_text(json.dumps({"type":"init_ok","library_id":library_id}))

                case "step":
                    ctrl_raw = msg.get("control", {})
                    ew_raw   = msg.get("ew",      {})
                    wind_raw = msg.get("wind",     {})

                    try:
                        # Lazy-init physics engine
                        if physics is None:
                            from app.simulation.physics.factory import physics_from_library
                            from app.simulation.physics.atmosphere import WindModel
                            wind    = WindModel(
                                wind_raw.get("speed",0.0),
                                wind_raw.get("dir_deg",0.0),
                                wind_raw.get("turbulence",0.0),
                            )
                            physics = physics_from_library(library_id, wind)
                        else:
                            # Update wind on existing engine if provided
                            if wind_raw:
                                from app.simulation.physics.atmosphere import WindModel
                                physics.wind = WindModel(
                                    wind_raw.get("speed",0.0),
                                    wind_raw.get("dir_deg",0.0),
                                    wind_raw.get("turbulence",0.0),
                                )

                        valid_c = ControlInput.__dataclass_fields__.keys()
                        cmd     = ControlInput(**{k:v for k,v in ctrl_raw.items() if k in valid_c})
                        ew      = EWInfluence(**{k:v for k,v in ew_raw.items() if k in EWInfluence.model_fields})

                        cmd       = _apply_ew_to_control(cmd, ew, dt)
                        new_state = physics.step(state, cmd, dt)
                        new_state = _apply_ew_to_state(new_state, ew, dt)
                        state     = new_state

                        stall = new_state.airspeed_ms < getattr(physics.cfg, "stall_speed_ms", 0)
                        await ws.send_text(json.dumps({
                            "type":  "state",
                            "state": new_state.to_dict(),
                            "diagnostics": {
                                "thrust_pct":   round(new_state.actual_throttle * 100, 1),
                                "fuel_pct":     round(new_state.fuel_remaining  * 100, 1),
                                "stall":        stall,
                                "ew_active":    ew.datalink_denied or ew.gps_denied,
                                "link_quality": round(ew.link_quality, 2),
                            },
                        }))
                    except Exception as ex:
                        await ws.send_text(json.dumps({"type":"error","msg":str(ex)}))

                case "reset":
                    state   = PhysicsState()
                    physics = None
                    await ws.send_text(json.dumps({"type":"reset_ok"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("ws.simulator.error", user_id=user_id, error=str(e))
    finally:
        hb_task.cancel()
        logger.info("ws.simulator.disconnected", user_id=user_id)
