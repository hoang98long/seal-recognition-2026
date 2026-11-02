import psycopg
from sqlalchemy.engine import make_url

from app.core.config import get_settings


def init_database():
    url = make_url(get_settings().database_url.get_secret_value())
    name = url.database
    with psycopg.connect(
        host=url.host,
        port=url.port or 5432,
        user=url.username,
        password=url.password,
        dbname="postgres",
        autocommit=True,
        connect_timeout=5,
    ) as connection:
        if not connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone():
            connection.execute(psycopg.sql.SQL("CREATE DATABASE {}").format(psycopg.sql.Identifier(name)))
            print(f"Đã tạo database {name}.")
        else:
            print(f"Database {name} đã tồn tại; giữ nguyên dữ liệu.")


if __name__ == "__main__":
    try:
        init_database()
    except psycopg.Error as exc:
        print(f"Không tạo được DB ({type(exc).__name__}). Tạo bằng pgAdmin: CREATE DATABASE seal_forensics;")
        raise SystemExit(1) from None
