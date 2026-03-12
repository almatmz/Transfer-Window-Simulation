from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App
    APP_ENV: str = "development"
    APP_NAME: str = "Transfer Window Simulator"
    APP_VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # ── Database
    MONGODB_URL: str
    DATABASE_NAME: str = "twsim"

    # ── Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── First-run admin seeding
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # ── External APIs
    API_FOOTBALL_KEY: str = ""
    API_FOOTBALL_KEY_TYPE: str = "direct"
    API_FOOTBALL_BASE_URL: str = "https://v3.football.api-sports.io"
    API_FOOTBALL_DAILY_LIMIT: int = 100

    # ── Scraping
    CAPOLOGY_BASE_URL: str = "https://www.capology.com"
    SCRAPE_CACHE_TTL_HOURS: int = 24

    # ── Cache
    REDIS_URL: str = ""

    # ── CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # ── Groq AI
    GROQ_API_KEY: str = ""

    # ── Apify (Transfermarkt scraper)
    APIFY_API_TOKEN: str = ""

    # ── Gemini AI (fallback to Groq)
    GEMINI_API_KEY: str = ""

    # ── Simulation constraints
    MAX_SIMULATION_FUTURE_YEARS: int = 3

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters. "
                "Generate one with: openssl rand -hex 32"
            )
        return v

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def has_redis(self) -> bool:
        return bool(self.REDIS_URL)

    @property
    def has_api_football(self) -> bool:
        return bool(self.API_FOOTBALL_KEY)

    @property
    def has_groq(self) -> bool:
        return bool(self.GROQ_API_KEY)

    @property
    def has_apify(self) -> bool:
        return bool(self.APIFY_API_TOKEN)

    @property
    def has_gemini(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def api_football_headers(self) -> dict:
        if self.API_FOOTBALL_KEY_TYPE == "rapidapi":
            return {
                "x-rapidapi-key": self.API_FOOTBALL_KEY,
                "x-rapidapi-host": "v3.football.api-sports.io",
            }
        return {"x-apisports-key": self.API_FOOTBALL_KEY}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()