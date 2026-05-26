"""Training system tests — courses, modules, scores, certification."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_list_courses(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.get("/api/training/courses", headers=clean)
    assert r.status_code == 200
    courses = r.json()["courses"]
    assert len(courses) >= 6
    ids = {c["id"] for c in courses}
    assert "fpv-basic" in ids
    assert "ew-awareness" in ids


async def test_filter_by_category(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.get("/api/training/courses?category=PILOT", headers=clean)
    assert r.status_code == 200
    for c in r.json()["courses"]:
        assert c["category"] == "PILOT"


async def test_start_course(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.post("/api/training/courses/fpv-basic/start", headers=clean)
    assert r.status_code == 200
    assert r.json()["started"] is True
    assert r.json()["attempts"] == 1


async def test_start_course_increments_attempts(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post("/api/training/courses/fpv-basic/start", headers=clean)
    r = await client.post("/api/training/courses/fpv-basic/start", headers=clean)
    assert r.json()["attempts"] == 2


async def test_complete_module_quiz(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post("/api/training/courses/fpv-basic/start", headers=clean)
    r = await client.post("/api/training/courses/fpv-basic/module", json={
        "module_id": "m5",
        "completed": True,
        "score":     85,
        "time_spent_s": 240,
        "answers":   [],
    }, headers=clean)
    assert r.status_code == 200
    data = r.json()
    assert data["passed"]  is True
    assert data["score"]   == 85


async def test_module_score_clamped(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post("/api/training/courses/fpv-basic/start", headers=clean)
    r = await client.post("/api/training/courses/fpv-basic/module", json={
        "module_id": "m5", "completed": True,
        "score": 150,        # over 100 — should be clamped
        "time_spent_s": 120, "answers": [],
    }, headers=clean)
    assert r.status_code == 200
    assert r.json()["score"] == 100


async def test_complete_all_modules_for_certification(client: AsyncClient, auth_headers: dict):
    """Complete all fpv-basic modules → certify → valid cert."""
    cid = "fpv-basic"
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post(f"/api/training/courses/{cid}/start", headers=clean)

    for mid in ["m1","m2","m3","m4"]:
        await client.post(f"/api/training/courses/{cid}/module", json={
            "module_id": mid, "completed": True, "score": 90,
            "time_spent_s": 120, "answers": [],
        }, headers=clean)

    r = await client.post(f"/api/training/courses/{cid}/module", json={
        "module_id": "m5", "completed": True, "score": 85,
        "time_spent_s": 240, "answers": [],
    }, headers=clean)
    assert r.json()["course_complete"] is True
    assert r.json()["can_certify"]     is True

    r2 = await client.post(f"/api/training/courses/{cid}/certify", headers=clean)
    assert r2.status_code == 200
    cert = r2.json()
    assert cert["cert_number"].startswith("SKY-")
    assert cert["grade"] in ("S","A","B","C")


async def test_certify_duplicate_rejected(client: AsyncClient, auth_headers: dict):
    """Second certification attempt returns 409."""
    cid = "fpv-basic"
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post(f"/api/training/courses/{cid}/start", headers=clean)
    for mid in ["m1","m2","m3","m4","m5"]:
        await client.post(f"/api/training/courses/{cid}/module", json={
            "module_id": mid, "completed": True, "score": 90,
            "time_spent_s": 60, "answers": [],
        }, headers=clean)
    await client.post(f"/api/training/courses/{cid}/certify", headers=clean)
    r = await client.post(f"/api/training/courses/{cid}/certify", headers=clean)
    assert r.status_code == 409


async def test_score_only_from_completed_modules(client: AsyncClient, auth_headers: dict):
    """Score should be 0 if no quiz modules completed."""
    cid = "fpv-basic"
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post(f"/api/training/courses/{cid}/start", headers=clean)
    for mid in ["m1","m2","m3","m4"]:
        await client.post(f"/api/training/courses/{cid}/module", json={
            "module_id": mid, "completed": True, "score": 0,
            "time_spent_s": 60, "answers": [],
        }, headers=clean)
    r = await client.get(f"/api/training/courses/{cid}", headers=clean)
    prog = r.json()["progress"]
    assert prog is not None
    assert prog["score"] == 0   # quiz not done → no score


async def test_certificate_verify_public(client: AsyncClient, auth_headers: dict):
    """Verify endpoint works without auth."""
    cid = "fpv-basic"
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post(f"/api/training/courses/{cid}/start", headers=clean)
    for mid in ["m1","m2","m3","m4","m5"]:
        await client.post(f"/api/training/courses/{cid}/module", json={
            "module_id": mid, "completed": True, "score": 92,
            "time_spent_s": 60, "answers": [],
        }, headers=clean)
    clean2 = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r_cert = await client.post(f"/api/training/courses/{cid}/certify", headers=clean2)
    assert r_cert.status_code == 200, f"Certify failed: {r_cert.text}"
    cert_number = r_cert.json()["cert_number"]

    # Verify without auth
    r = await client.get(f"/api/training/verify/{cert_number}")
    assert r.status_code == 200
    data = r.json()
    assert data["valid"]       is True
    assert data["status"]      == "VALID"
    assert data["cert_number"] == cert_number
    # holder is the dynamic username from auth fixture
    assert data["holder"] == auth_headers.get("_username", data["holder"])


async def test_leaderboard(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    r = await client.get("/api/training/leaderboard", headers=clean)
    assert r.status_code == 200
    assert "leaderboard" in r.json()
    assert "total" in r.json()


async def test_my_progress(client: AsyncClient, auth_headers: dict):
    clean = {k:v for k,v in auth_headers.items() if not k.startswith("_")}
    await client.post("/api/training/courses/fpv-basic/start", headers=clean)
    r = await client.get("/api/training/my-progress", headers=clean)
    assert r.status_code == 200
    progress = r.json()["progress"]
    assert any(p["course_id"] == "fpv-basic" for p in progress)
