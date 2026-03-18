from __future__ import annotations


class ProviderError(RuntimeError):
    code = "PROVIDER_ERROR"
    message = "Provider operation failed"
    status_code = 500

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        self.user_message = message or self.message


class ProviderNotFoundError(ProviderError):
    code = "PROVIDER_NOT_FOUND"
    message = "Provider does not exist"
    status_code = 404


class ProviderConflictError(ProviderError):
    code = "PROVIDER_CONFLICT"
    message = "Provider conflicts with existing configuration"
    status_code = 409


class ProviderValidationError(ProviderError):
    code = "PROVIDER_VALIDATION_FAILED"
    message = "Provider configuration is invalid"
    status_code = 422


class ProviderTypeImmutableError(ProviderError):
    code = "PROVIDER_TYPE_IMMUTABLE"
    message = "Provider type cannot be changed"
    status_code = 409


class ProviderActiveNotSetError(ProviderError):
    code = "PROVIDER_ACTIVE_NOT_SET"
    message = "No active provider configured"
    status_code = 404


class ProviderSecretDecryptError(ProviderError):
    code = "PROVIDER_SECRET_DECRYPT_FAILED"
    message = "Provider secret cannot be decrypted"
    status_code = 500


class ProviderRotationInProgressError(ProviderError):
    code = "PROVIDER_ROTATION_IN_PROGRESS"
    message = "Provider key rotation is in progress"
    status_code = 503


class ProviderActivationConflictError(ProviderError):
    code = "PROVIDER_ACTIVATION_CONFLICT"
    message = "Provider activation conflict occurred"
    status_code = 409


class ProviderAuthFailedError(ProviderError):
    code = "PROVIDER_AUTH_FAILED"
    message = "Provider authentication failed"
    status_code = 401


class ProviderRateLimitedError(ProviderError):
    code = "PROVIDER_RATE_LIMITED"
    message = "Provider rate limited request"
    status_code = 429


class ProviderUpstreamUnavailableError(ProviderError):
    code = "PROVIDER_UPSTREAM_UNAVAILABLE"
    message = "Provider upstream is unavailable"
    status_code = 502
