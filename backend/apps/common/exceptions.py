"""Uniform API error format: {"error": {"code": ..., "message": ..., "details"?: ...}}."""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

_DEFAULT_CODES = {
    status.HTTP_400_BAD_REQUEST: "INVALID_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "NOT_AUTHENTICATED",
    status.HTTP_403_FORBIDDEN: "PERMISSION_DENIED",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    status.HTTP_429_TOO_MANY_REQUESTS: "THROTTLED",
}


class ServiceError(exceptions.APIException):
    """Base class for domain errors raised by services and exposed to clients."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "INVALID_REQUEST"
    default_detail = "Solicitud inválida."


class ExternalServiceUnavailable(ServiceError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "EXTERNAL_SERVICE_UNAVAILABLE"
    default_detail = "El servicio externo no está disponible. Intentá nuevamente en unos minutos."


def _error_code(exc: exceptions.APIException, status_code: int) -> str:
    if isinstance(exc, ServiceError):
        return exc.default_code
    if isinstance(exc, exceptions.ValidationError):
        return "VALIDATION_ERROR"
    if isinstance(exc, exceptions.NotAuthenticated):
        return "NOT_AUTHENTICATED"
    if isinstance(exc, exceptions.AuthenticationFailed):
        codes = exc.get_codes()
        if isinstance(codes, dict) and codes.get("code") == "token_not_valid":
            return "TOKEN_INVALID"
        return "AUTHENTICATION_FAILED"
    return _DEFAULT_CODES.get(status_code, "ERROR")


def _error_message(exc: exceptions.APIException) -> str:
    if isinstance(exc, exceptions.ValidationError):
        return "Los datos enviados no son válidos."
    detail = exc.detail
    if isinstance(detail, dict):
        detail = detail.get("detail", next(iter(detail.values()), ""))
    if isinstance(detail, list):
        detail = detail[0] if detail else ""
    return str(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound("Recurso no encontrado.")
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        # Unexpected error: log it, never leak a traceback to the client.
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"error": {"code": "INTERNAL_ERROR", "message": "Error interno del servidor."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    error: dict = {
        "code": _error_code(exc, response.status_code),
        "message": _error_message(exc),
    }
    if isinstance(exc, exceptions.ValidationError):
        error["details"] = exc.detail
    response.data = {"error": error}
    return response
