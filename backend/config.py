"""Application settings — reads from .env via pydantic-settings."""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Deployment mode
    mode: str = Field("standalone", alias="BCK_WEB_MODE")  # "standalone" | "hub"

    # Uvicorn bind
    host: str = Field("127.0.0.1", alias="BCK_WEB_HOST")
    port: int = Field(8080, alias="BCK_WEB_PORT")

    # Security
    secret_key: str = Field(..., alias="BCK_WEB_SECRET_KEY")
    access_token_expire_hours: int = Field(8, alias="BCK_WEB_ACCESS_TOKEN_EXPIRE_HOURS")
    refresh_token_expire_days: int = Field(30, alias="BCK_WEB_REFRESH_TOKEN_EXPIRE_DAYS")

    # BCK Manager integration
    bck_manager_path: str = Field("/opt/bck_manager", alias="BCK_MANAGER_PATH")
    bck_config_path: str = Field("/opt/bck_manager/config.yaml", alias="BCK_CONFIG_PATH")
    bck_log_path: str = Field("/var/log/bck_manager.log", alias="BCK_LOG_PATH")

    # Database
    db_path: str = Field("/opt/bck_manager_web/bck_web.db", alias="BCK_WEB_DB_PATH")

    # Logging
    log_level: str = Field("INFO", alias="BCK_WEB_LOG_LEVEL")
    log_file: str = Field("/var/log/bck_manager_web/web.log", alias="BCK_WEB_LOG_FILE")

    # Update checker
    github_repo: str = Field("giuva90/BCK_Manager_Web", alias="BCK_WEB_GITHUB_REPO")
    update_check_enabled: bool = Field(True, alias="BCK_WEB_UPDATE_CHECK_ENABLED")
    update_check_interval_hours: int = Field(6, alias="BCK_WEB_UPDATE_CHECK_INTERVAL_HOURS")

    # App metadata
    # Single source of truth for the application version.
    # Update this when cutting a release — it is served via GET /api/v1/system/status
    # and displayed on the dashboard. Keep in sync with frontend/package.json.
    app_version: str = "0.2.0"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
