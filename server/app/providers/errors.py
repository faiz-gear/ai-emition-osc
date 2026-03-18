from __future__ import annotations


class ProviderError(RuntimeError):
    code = "PROVIDER_ERROR"
    message = "Provider operation failed"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        self.user_message = message or self.message


class ProviderNotFoundError(ProviderError):
    code = "PROVIDER_NOT_FOUND"
    message = "Provider does not exist"


class ProviderConflictError(ProviderError):
    code = "PROVIDER_CONFLICT"
    message = "Provider conflicts with existing configuration"


class ProviderValidationError(ProviderError):
    code = "PROVIDER_VALIDATION_FAILED"
    message = "Provider configuration is invalid"


class ProviderTypeImmutableError(ProviderError):
    code = "PROVIDER_TYPE_IMMUTABLE"
    message = "Provider type cannot be changed"


class ProviderActiveNotSetError(ProviderError):
    code = "PROVIDER_ACTIVE_NOT_SET"
    message = "No active provider configured"


class ProviderSecretDecryptError(ProviderError):
    code = "PROVIDER_SECRET_DECRYPT_FAILED"
    message = "Provider secret cannot be decrypted"


class ProviderRotationInProgressError(ProviderError):
    code = "PROVIDER_ROTATION_IN_PROGRESS"
    message = "Provider key rotation is in progress"


class ProviderActivationConflictError(ProviderError):
    code = "PROVIDER_ACTIVATION_CONFLICT"
    message = "Provider activation conflict occurred"
