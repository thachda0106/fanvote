package com.eventista.commerce.common;

/**
 * Contract-shaped error taxonomy (ground rule 8): 4xx client errors, typed
 * 503 for dependency degradation, 500 for bugs. The response envelope is
 * {@code {code, message, requestId}}.
 */
public class ApiError extends RuntimeException {

  public enum Code {
    VALIDATION_FAILED(400),
    NOT_FOUND(404),
    DEPENDENCY_UNAVAILABLE(503),
    INTERNAL_ERROR(500);

    private final int status;

    Code(int status) {
      this.status = status;
    }

    public int status() {
      return status;
    }
  }

  private final Code code;

  public ApiError(Code code, String message) {
    super(message);
    this.code = code;
  }

  public Code code() {
    return code;
  }
}
