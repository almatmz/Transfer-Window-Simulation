import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_create_club():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/clubs/",
            json={
                "name": "Test FC",
                "short_name": "TFC",
                "country": "England",
                "league": "Premier League",
                "annual_revenue": 500_000_000,
                "wage_budget": 250_000_000,
                "transfer_budget": 100_000_000,
                "season_year": 2024,
            },
        )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test FC"
    assert data["annual_revenue"] == 500_000_000


@pytest.mark.asyncio
async def test_create_club_wage_exceeds_revenue_fails():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/clubs/",
            json={
                "name": "Broke FC",
                "short_name": "BFC",
                "country": "Spain",
                "league": "La Liga",
                "annual_revenue": 100_000_000,
                "wage_budget": 200_000_000,  # exceeds revenue
                "transfer_budget": 50_000_000,
                "season_year": 2024,
            },
        )
    assert response.status_code == 422