package com.eventista.commerce.common;

import static net.logstash.logback.argument.StructuredArguments.kv;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * T1.6: accepts or generates X-Request-Id, echoes it, and logs one JSON line
 * per request with the fields the plan requires. Trace ids are added to MDC
 * by the OTel Java agent (absent in unit tests, harmless).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ObservabilityFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger("http");
  private static final Set<String> PROBES = Set.of("/healthz", "/readyz", "/metrics");

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return PROBES.contains(request.getRequestURI());
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    long started = System.nanoTime();
    String incoming = request.getHeader("x-request-id");
    String requestId = (incoming == null || incoming.isBlank()) ? UUID.randomUUID().toString() : incoming;
    request.setAttribute("requestId", requestId);
    response.setHeader("x-request-id", requestId);
    MDC.put("request_id", requestId);
    try {
      chain.doFilter(request, response);
    } finally {
      long durationMs = (System.nanoTime() - started) / 1_000_000;
      log.info(
          "http.request",
          kv("method", request.getMethod()),
          kv("route", request.getRequestURI()),
          kv("status", response.getStatus()),
          kv("duration_ms", durationMs));
      MDC.remove("request_id");
    }
  }
}
