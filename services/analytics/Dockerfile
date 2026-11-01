# syntax=docker/dockerfile:1
FROM python:3.12.12-slim AS build
WORKDIR /app
RUN pip install --no-cache-dir uv==0.12.1
COPY pyproject.toml ./
RUN uv lock && uv sync --no-install-project
COPY app ./app
RUN uv sync --no-install-project

FROM python:3.12.12-slim
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
COPY --from=build /app/.venv /app/.venv
COPY app ./app
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
