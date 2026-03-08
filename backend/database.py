"""SQLite database engine and session factory via SQLModel."""

from sqlmodel import SQLModel, Session, create_engine
from backend.config import settings

DATABASE_URL = f"sqlite:///{settings.db_path}"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create all tables.  Safe to call multiple times."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency that yields a DB session."""
    with Session(engine) as session:
        yield session
