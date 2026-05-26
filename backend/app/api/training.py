import structlog, random, string
from app.core.metrics import inc_quiz_completed, inc_cert_issued
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, field_validator
from app.core.database import get_db
from app.core.pagination import PageParams, Page
from app.api.auth import get_current_user
from app.models.user import User
from app.models.training import UserProgress, Certificate

logger = structlog.get_logger()
router = APIRouter()

# ── Course catalog (in-memory) ────────────────────────────────────

COURSES = [
    {"id":"fpv-basic","title":"FPV Operator — Basic","description":"Fundamentals of FPV drone operation: controls, OSD, failsafes, basic maneuvers.","category":"PILOT","difficulty":"BEGINNER","duration_min":90,"uav_class":"MICRO_FPV","modules":[
        {"id":"m1","title":"Introduction to FPV","type":"theory","duration_min":15},
        {"id":"m2","title":"Controls & OSD","type":"theory","duration_min":20},
        {"id":"m3","title":"Basic Flight Sim","type":"simulator","duration_min":30},
        {"id":"m4","title":"Failsafe Procedures","type":"theory","duration_min":15},
        {"id":"m5","title":"Basic Assessment","type":"quiz","duration_min":10,"pass_score":75}]},
    {"id":"fpv-strike","title":"FPV Strike Operator","description":"Advanced FPV for combat ops: target acquisition, attack profiles, threat avoidance.","category":"PILOT","difficulty":"ADVANCED","duration_min":180,"uav_class":"STRIKE_FPV","modules":[
        {"id":"m1","title":"Strike FPV Systems","type":"theory","duration_min":25},
        {"id":"m2","title":"Target Acquisition","type":"theory","duration_min":20},
        {"id":"m3","title":"Attack Profiles","type":"simulator","duration_min":60},
        {"id":"m4","title":"EW Threat Response","type":"simulator","duration_min":40},
        {"id":"m5","title":"Strike Assessment","type":"quiz","duration_min":20,"pass_score":80},
        {"id":"m6","title":"Practical Exam","type":"practical","duration_min":30,"pass_score":80}]},
    {"id":"isr-tactical","title":"Tactical ISR Operator","description":"ISR UAV operations: mission planning, sensor management, target reporting.","category":"PILOT","difficulty":"INTERMEDIATE","duration_min":150,"uav_class":"FIXED_WING_ISR","modules":[
        {"id":"m1","title":"ISR Fundamentals","type":"theory","duration_min":30},
        {"id":"m2","title":"Sensor Management","type":"theory","duration_min":25},
        {"id":"m3","title":"Mission Planning","type":"simulator","duration_min":45},
        {"id":"m4","title":"Target Reporting","type":"theory","duration_min":20},
        {"id":"m5","title":"ISR Assessment","type":"quiz","duration_min":15,"pass_score":78},
        {"id":"m6","title":"Practical ISR Mission","type":"practical","duration_min":45,"pass_score":78}]},
    {"id":"ew-awareness","title":"EW Threat Awareness","description":"Electronic warfare: GPS jamming/spoofing, datalink protection, countermeasures.","category":"ENGINEER","difficulty":"INTERMEDIATE","duration_min":120,"uav_class":None,"modules":[
        {"id":"m1","title":"EW Fundamentals","type":"theory","duration_min":30},
        {"id":"m2","title":"GPS Threats","type":"theory","duration_min":25},
        {"id":"m3","title":"Datalink Security","type":"theory","duration_min":20},
        {"id":"m4","title":"EW Simulator","type":"simulator","duration_min":30},
        {"id":"m5","title":"EW Assessment","type":"quiz","duration_min":15,"pass_score":80}]},
    {"id":"mission-cmd","title":"Mission Commander","description":"Tactical planning, multi-UAV coordination, threat assessment, AAR.","category":"COMMANDER","difficulty":"EXPERT","duration_min":240,"uav_class":None,"modules":[
        {"id":"m1","title":"Command & Control","type":"theory","duration_min":40},
        {"id":"m2","title":"Threat Assessment","type":"theory","duration_min":30},
        {"id":"m3","title":"Mission Planning Lab","type":"simulator","duration_min":60},
        {"id":"m4","title":"Multi-UAV Ops","type":"simulator","duration_min":60},
        {"id":"m5","title":"Command Assessment","type":"quiz","duration_min":20,"pass_score":85},
        {"id":"m6","title":"Full Mission Exam","type":"practical","duration_min":60,"pass_score":85}]},
    {"id":"male-systems","title":"MALE Systems Engineer","description":"MALE UAV: airframe, propulsion, avionics, maintenance procedures.","category":"ENGINEER","difficulty":"EXPERT","duration_min":300,"uav_class":"MALE","modules":[
        {"id":"m1","title":"MALE Airframe","type":"theory","duration_min":50},
        {"id":"m2","title":"Propulsion Systems","type":"theory","duration_min":40},
        {"id":"m3","title":"Avionics & Sensors","type":"theory","duration_min":50},
        {"id":"m4","title":"Maintenance Sim","type":"simulator","duration_min":80},
        {"id":"m5","title":"Systems Assessment","type":"quiz","duration_min":30,"pass_score":85},
        {"id":"m6","title":"Practical Exam","type":"practical","duration_min":60,"pass_score":85}]},
]

def _cert_num() -> str:
    return f"SKY-{datetime.now().year}-{''.join(random.choices(string.ascii_uppercase+string.digits,k=6))}"

def _grade(s: int) -> str:
    return "S" if s>=95 else "A" if s>=85 else "B" if s>=75 else "C" if s>=65 else "F"

def _course(cid: str) -> dict | None:
    return next((c for c in COURSES if c["id"]==cid), None)

def _compute_progress(module_data: dict, course: dict) -> float:
    """
    Progress = fraction of ALL modules completed.
    Theory/sim modules count as completed if module_data[id].completed is True.
    Quiz/practical modules count only if score >= pass_score.
    """
    total = len(course["modules"])
    if total == 0:
        return 0.0
    done = 0
    for m in course["modules"]:
        md = module_data.get(m["id"], {})
        if not md.get("completed", False):
            continue
        if m["type"] in ("quiz", "practical"):
            if md.get("score", 0) >= m.get("pass_score", 70):
                done += 1
        else:
            done += 1
    return round(done / total * 100, 1)

def _compute_score(module_data: dict, course: dict) -> int:
    """
    Overall score = average of COMPLETED quiz/practical modules only.
    Excludes modules not yet attempted or not passed.
    """
    quiz_mods = [m for m in course["modules"] if m["type"] in ("quiz", "practical")]
    if not quiz_mods:
        return 0
    completed_scores = [
        module_data[m["id"]]["score"]
        for m in quiz_mods
        if m["id"] in module_data
        and module_data[m["id"]].get("completed", False)
        and module_data[m["id"]].get("score", 0) >= m.get("pass_score", 70)
    ]
    if not completed_scores:
        return 0
    return round(sum(completed_scores) / len(completed_scores))

# ── Schemas ───────────────────────────────────────────────────────

class ModuleProgressPayload(BaseModel):
    module_id:    str
    completed:    bool  = False
    score:        int   = 0
    time_spent_s: int   = 0
    answers:      list  = []

    @field_validator("score")
    @classmethod
    def clamp_score(cls, v: int) -> int:
        return max(0, min(100, v))

# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/courses")
async def list_courses(
    category:     str | None = None,
    difficulty:   str | None = None,
    current_user: User = Depends(get_current_user),
):
    courses = COURSES
    if category:
        courses = [c for c in courses if c["category"] == category.upper()]
    if difficulty:
        courses = [c for c in courses if c["difficulty"] == difficulty.upper()]
    return {"courses": courses, "total": len(courses)}


@router.get("/courses/{cid}")
async def get_course(
    cid:          str,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    c = _course(cid)
    if not c:
        raise HTTPException(404, "Course not found")

    r = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id  == current_user.id,
            UserProgress.course_id == cid,
        )
    )
    p = r.scalar_one_or_none()
    return {
        "course": c,
        "progress": {
            "progress_pct": p.progress_pct,
            "completed":    p.completed,
            "score":        p.score,
            "attempts":     p.attempts,
            "module_data":  p.module_data,
            "started_at":   p.started_at.isoformat(),
            "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        } if p else None,
    }


@router.post("/courses/{cid}/start")
async def start_course(
    cid:          str,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    if not _course(cid):
        raise HTTPException(404, "Course not found")
    r = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id == current_user.id,
            UserProgress.course_id == cid,
        )
    )
    p = r.scalar_one_or_none()
    if not p:
        p = UserProgress(user_id=current_user.id, course_id=cid, attempts=1, module_data={})
        db.add(p)
    else:
        p.attempts += 1
    await db.commit()
    return {"started": True, "attempts": p.attempts}


@router.post("/courses/{cid}/module")
async def complete_module(
    cid:          str,
    payload:      ModuleProgressPayload,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Record completion of a single module. Recomputes course progress + score correctly."""
    c = _course(cid)
    if not c:
        raise HTTPException(404, "Course not found")

    mod = next((m for m in c["modules"] if m["id"] == payload.module_id), None)
    if not mod:
        raise HTTPException(404, "Module not found")

    r = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id == current_user.id,
            UserProgress.course_id == cid,
        )
    )
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(400, "Start course first")

    is_assessment = mod["type"] in ("quiz", "practical")
    pass_score    = mod.get("pass_score", 70)
    passed        = payload.score >= pass_score if is_assessment else True

    # Preserve best score (don't overwrite with worse attempt)
    existing = p.module_data.get(payload.module_id, {})
    best_score = max(existing.get("score", 0), payload.score)

    p.module_data = {
        **p.module_data,
        payload.module_id: {
            "completed":    payload.completed and passed,
            "score":        best_score,
            "passed":       passed,
            "time_spent_s": payload.time_spent_s,
            "attempts":     existing.get("attempts", 0) + 1,
            "last_attempt": datetime.now(timezone.utc).isoformat(),
        },
    }

    # Recompute using fixed functions
    p.progress_pct = _compute_progress(p.module_data, c)
    p.score        = _compute_score(p.module_data, c)

    if p.progress_pct >= 100 and not p.completed:
        p.completed    = True
        p.completed_at = datetime.now(timezone.utc)
        logger.info("training.course_completed", user=current_user.id, course=cid, score=p.score)

    # Check if can certify
    min_pass = max(
        (m.get("pass_score", 70) for m in c["modules"] if m["type"] in ("quiz","practical")),
        default=70,
    )
    can_certify = p.completed and p.score >= min_pass

    await db.commit()
    return {
        "module_id":       payload.module_id,
        "passed":          passed,
        "score":           best_score,
        "pass_score":      pass_score,
        "progress_pct":    p.progress_pct,
        "overall_score":   p.score,
        "course_complete": p.completed,
        "can_certify":     can_certify,
    }


@router.post("/courses/{cid}/certify")
async def certify(
    cid:          str,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    c = _course(cid)
    if not c:
        raise HTTPException(404, "Course not found")

    r = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id == current_user.id,
            UserProgress.course_id == cid,
        )
    )
    p = r.scalar_one_or_none()
    if not p or not p.completed:
        raise HTTPException(400, "Course not completed")

    min_pass = max(
        (m.get("pass_score", 70) for m in c["modules"] if m["type"] in ("quiz","practical")),
        default=70,
    )
    if p.score < min_pass:
        raise HTTPException(400, f"Score {p.score} below minimum {min_pass}")

    # Duplicate check
    existing = await db.execute(
        select(Certificate).where(
            Certificate.user_id  == current_user.id,
            Certificate.course_id == cid,
            Certificate.valid    == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Certificate already issued for this course")

    cert = Certificate(
        user_id     = current_user.id,
        course_id   = cid,
        cert_number = _cert_num(),
        score       = p.score,
        grade       = _grade(p.score),
        expires_at  = datetime.now(timezone.utc) + timedelta(days=730),
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    inc_cert_issued()
    logger.info("training.cert_issued", user=current_user.id, course=cid,
                cert=cert.cert_number, grade=cert.grade)
    return {
        "cert_number": cert.cert_number,
        "grade":       cert.grade,
        "score":       cert.score,
        "issued_at":   cert.issued_at.isoformat(),
        "expires_at":  cert.expires_at.isoformat(),
        "verify_url":  f"/verify/{cert.cert_number}",
    }


@router.get("/certificates")
async def my_certs(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Certificate)
        .where(Certificate.user_id == current_user.id)
        .order_by(Certificate.issued_at.desc())
    )
    return {
        "certificates": [
            {
                "id":          c.id,
                "course_id":   c.course_id,
                "cert_number": c.cert_number,
                "score":       c.score,
                "grade":       c.grade,
                "issued_at":   c.issued_at.isoformat(),
                "expires_at":  c.expires_at.isoformat() if c.expires_at else None,
                "valid":       c.valid,
            }
            for c in r.scalars().all()
        ]
    }


@router.get("/my-progress")
async def my_progress(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(UserProgress).where(UserProgress.user_id == current_user.id)
    )
    rows = r.scalars().all()
    return {
        "progress": [
            {
                "course_id":    p.course_id,
                "progress_pct": p.progress_pct,
                "score":        p.score,
                "completed":    p.completed,
                "attempts":     p.attempts,
            }
            for p in rows
        ]
    }


@router.get("/leaderboard")
async def leaderboard(
    course_id:    str | None   = None,
    params:       PageParams    = Depends(),
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    q = select(UserProgress, User).join(User, UserProgress.user_id == User.id)
    if course_id:
        q = q.where(UserProgress.course_id == course_id)
    q = q.where(UserProgress.completed == True)

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total   = total_r.scalar() or 0

    q = q.order_by(UserProgress.score.desc()).limit(params.limit).offset(params.offset)
    rows = (await db.execute(q)).all()

    return {
        "leaderboard": [
            {
                "rank":      params.offset + i + 1,
                "username":  row.User.username,
                "score":     row.UserProgress.score,
                "course_id": row.UserProgress.course_id,
                "grade":     _grade(row.UserProgress.score),
            }
            for i, row in enumerate(rows)
        ],
        "total":  total,
        "limit":  params.limit,
        "offset": params.offset,
    }


# ── Public certificate verification ──────────────────────────────

@router.get("/verify/{cert_number}")
async def verify_certificate(
    cert_number: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — no auth required.
    Verifies a certificate by number and returns its status.
    """
    r = await db.execute(
        select(Certificate, User)
        .join(User, Certificate.user_id == User.id)
        .where(Certificate.cert_number == cert_number)
    )
    row = r.first()
    if not row:
        raise HTTPException(404, "Certificate not found")

    cert, user = row
    course = _course(cert.course_id)

    now     = datetime.now(timezone.utc)
    # SQLite returns naive datetimes — make aware before comparing
    exp_at = cert.expires_at
    if exp_at is not None and exp_at.tzinfo is None:
        from datetime import timezone as tz
        exp_at = exp_at.replace(tzinfo=tz.utc)
    expired = exp_at is not None and exp_at < now

    return {
        "valid":        cert.valid and not expired,
        "cert_number":  cert.cert_number,
        "holder":       user.username,
        "course_id":    cert.course_id,
        "course_title": course["title"] if course else cert.course_id,
        "score":        cert.score,
        "grade":        cert.grade,
        "issued_at":    cert.issued_at.isoformat(),
        "expires_at":   cert.expires_at.isoformat() if cert.expires_at else None,
        "expired":      expired,
        "status":       "EXPIRED" if expired else ("REVOKED" if not cert.valid else "VALID"),
    }
