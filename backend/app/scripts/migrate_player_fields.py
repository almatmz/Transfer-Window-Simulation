import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient


MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "twsim")


async def migrate():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    player_result = await db["players"].update_many(
        {},
        {
            "$set": {
                "acquisition_fee": 0.0,
                "acquisition_year": 0,
                "contract_signing_date": None,
                "is_sold": False,
                "sold_for": 0.0,
                "sold_in_year": 0,
            }
        },
    )
    print(f"Players updated: {player_result.modified_count}")

    salary_fix = await db["players"].update_many(
        {"salary_source": "capology_estimate", "estimated_annual_salary": 0.0},
        {"$set": {"salary_source": "position_estimate"}},
    )
    print(f"Players salary_source fixed: {salary_fix.modified_count}")

    clubs = await db["clubs"].find({}).to_list(length=None)
    club_migrated = 0
    for club in clubs:
        old_rev = club.get("annual_revenue", 0.0)
        await db["clubs"].update_one(
            {"_id": club["_id"]},
            {
                "$set": {
                    "official_annual_revenue": old_rev,
                    "official_revenue_set_by": "",
                    "official_revenue_season_year": club.get("season_year", 0),
                    "user_annual_revenue": 0.0,
                    "user_revenue_set_by": "",
                    "user_revenue_season_year": 0,
                },
                "$unset": {"annual_revenue": ""},
            },
        )
        club_migrated += 1
    print(f"Clubs migrated: {club_migrated}")

    so_result = await db["salary_overrides"].update_many(
        {},
        {
            "$set": {
                "contract_signing_date": None,
            }
        },
    )
    print(f"SalaryOverrides updated: {so_result.modified_count}")

    print("Migration complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())