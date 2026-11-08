package com.eventista.commerce.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Maps thrown errors to the shared {code, message, requestId} envelope. */
@RestControllerAdvice
public class ErrorHandler {

  private static final Logger log = LoggerFactory.getLogger(ErrorHandler.class);

  @ExceptionHandler(ApiError.class)
  public ResponseEntity<Map<String, Object>> handleApiError(
      ApiError error, HttpServletRequest request) {
    return ResponseEntity.status(error.code().status()).body(envelope(error.code().name(), error.getMessage(), request));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<Map<String, Object>> handleMissingRoute(
      NoResourceFoundException error, HttpServletRequest request) {
    return ResponseEntity.status(404).body(envelope("NOT_FOUND", "not found", request));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleUnexpected(
      Exception error, HttpServletRequest request) {
    log.error("http.unhandled error={}", error.getMessage(), error);
    return ResponseEntity.status(500).body(envelope("INTERNAL_ERROR", "unexpected error", request));
  }

  private Map<String, Object> envelope(String code, String message, HttpServletRequest request) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("code", code);
    body.put("message", message);
    body.put("requestId", request.getAttribute("requestId"));
    return body;
  }
}
