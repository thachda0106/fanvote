"""Error classification (ground rule 8): 4xx / 5xx / typed-503 taxonomy."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base for contract-shaped errors: {code, message, requestId}."""

    code = "INTERNAL_ERROR"
    status = 500

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        if code:
            self.code = code
        self.message = message


class ValidationFailed(AppError):
    code = "VALIDATION_FAILED"
    status = 400


class NotFound(AppError):
    code = "NOT_FOUND"
    status = 404


class DependencyUnavailable(AppError):
    """Typed 503 — metered separately from INTERNAL_ERROR bugs."""

    code = "DEPENDENCY_UNAVAILABLE"
    status = 503


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "requestId": request_id},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": str(exc) or "unexpected error",
            "requestId": request_id,
        },
    )