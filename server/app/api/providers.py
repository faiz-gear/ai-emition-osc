from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..providers.base import CreateProviderInput
from ..providers.errors import (
    ProviderActivationConflictError,
    ProviderActiveNotSetError,
    ProviderConflictError,
    ProviderError,
    ProviderNotFoundError,
    ProviderRotationInProgressError,
    ProviderSecretDecryptError,
    ProviderTypeImmutableError,
    ProviderValidationError,
)


router = APIRouter()


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ProviderSummaryResponse(BaseModel):
    id: str
    name: str
    provider_type: Literal["ollama", "openai", "openai_compatible"]
    provider_key: Optional[str] = None
    model: str
    base_url: Optional[str] = None
    temperature: Optional[float] = None
    is_active: bool
    updated_at: str
    has_api_key: Optional[bool]
    headers_keys: Optional[List[str]]
    status: Literal["ok", "degraded"]
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class ProviderTestResponse(BaseModel):
    ok: bool
    latency_ms: float


class CreateProviderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    provider_type: Literal["ollama", "openai", "openai_compatible"]
    provider_key: Optional[str] = None
    model: str = Field(min_length=1, max_length=128)
    base_url: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    api_key: Optional[str] = None
    headers: Optional[Dict[str, str]] = None


class PatchProviderRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    provider_type: Optional[Literal["ollama", "openai", "openai_compatible"]] = None
    provider_key: Optional[str] = None
    model: Optional[str] = Field(default=None, min_length=1, max_length=128)
    base_url: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    api_key: Optional[str] = None
    headers: Optional[Dict[str, str]] = None


def _summary_payload(summary: Any) -> dict[str, Any]:
    payload = asdict(summary)
    payload["updated_at"] = summary.updated_at.isoformat()
    return payload


def _raise_provider_http(exc: ProviderError) -> None:
    status = 500
    if isinstance(exc, ProviderNotFoundError):
        status = 404
    elif isinstance(exc, ProviderActiveNotSetError):
        status = 404
    elif isinstance(exc, ProviderValidationError):
        status = 422
    elif isinstance(exc, ProviderTypeImmutableError):
        status = 409
    elif isinstance(exc, ProviderConflictError):
        status = 409
    elif isinstance(exc, ProviderActivationConflictError):
        status = 409
    elif isinstance(exc, ProviderSecretDecryptError):
        status = 500
    elif isinstance(exc, ProviderRotationInProgressError):
        status = 503

    raise HTTPException(
        status_code=status,
        detail=ErrorResponse(
            code=exc.code,
            message=exc.user_message,
            details={},
        ).model_dump(),
    )


@router.get("/api/providers", response_model=list[ProviderSummaryResponse])
async def list_providers(request: Request) -> list[dict[str, Any]]:
    service = request.app.state.provider_service
    summaries = await service.list_summaries()
    return [_summary_payload(summary) for summary in summaries]


@router.post("/api/providers", response_model=ProviderSummaryResponse, status_code=201)
async def create_provider(
    request: Request, payload: CreateProviderRequest
) -> dict[str, Any]:
    service = request.app.state.provider_service
    try:
        summary = await service.create_provider(
            CreateProviderInput(
                name=payload.name,
                provider_type=payload.provider_type,
                provider_key=payload.provider_key,
                model=payload.model,
                base_url=payload.base_url,
                temperature=payload.temperature,
                api_key=payload.api_key,
                headers=payload.headers,
            )
        )
    except ProviderError as exc:
        _raise_provider_http(exc)
    return _summary_payload(summary)


@router.patch("/api/providers/{provider_id}", response_model=ProviderSummaryResponse)
async def update_provider(
    provider_id: str, request: Request, payload: PatchProviderRequest
) -> dict[str, Any]:
    service = request.app.state.provider_service
    try:
        summary = await service.update_provider(
            provider_id,
            payload.model_dump(exclude_unset=True),
        )
    except ProviderError as exc:
        _raise_provider_http(exc)
    return _summary_payload(summary)


@router.delete("/api/providers/{provider_id}", status_code=204)
async def delete_provider(provider_id: str, request: Request) -> Response:
    service = request.app.state.provider_service
    try:
        await service.delete_provider(provider_id)
    except ProviderError as exc:
        _raise_provider_http(exc)
    return Response(status_code=204)


@router.post(
    "/api/providers/{provider_id}/activate", response_model=ProviderSummaryResponse
)
async def activate_provider(provider_id: str, request: Request) -> dict[str, Any]:
    service = request.app.state.provider_service
    try:
        summary = await service.activate_provider(provider_id)
    except ProviderError as exc:
        _raise_provider_http(exc)
    return _summary_payload(summary)


@router.post("/api/providers/{provider_id}/test", response_model=ProviderTestResponse)
async def test_provider(provider_id: str, request: Request) -> dict[str, Any]:
    service = request.app.state.provider_service
    try:
        result = await service.test_provider(provider_id)
    except ProviderError as exc:
        _raise_provider_http(exc)
    return asdict(result)


@router.get("/api/providers/active", response_model=ProviderSummaryResponse)
async def get_active_provider(request: Request) -> dict[str, Any]:
    service = request.app.state.provider_service
    try:
        summary = await service.get_active_summary()
    except ProviderError as exc:
        _raise_provider_http(exc)
    return _summary_payload(summary)
