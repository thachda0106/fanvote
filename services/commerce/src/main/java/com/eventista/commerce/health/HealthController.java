package com.eventista.commerce.health;

import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Observability surface (T1.6): /healthz liveness is datastore-independent;
 * /readyz returns 503 when degraded (D-12 — datastore checks land with the
 * first schema, T3.6); /metrics scrapes the Micrometer Prometheus registry
 * (RED series from the servlet instrumentation + JVM metrics).
 */
@RestController
public class HealthController {

  private final PrometheusMeterRegistry registry;

  public HealthController(PrometheusMeterRegistry registry) {
    this.registry = registry;
  }

  @GetMapping("/healthz")
  public Map<String, String> healthz() {
    return Map.of("status", "ok");
  }

  @GetMapping("/readyz")
  public Map<String, Object> readyz() {
    // Phase 1: no datastore checks yet — never boot-fail on a blip (R-17).
    return Map.of("status", "ready", "checks", List.of());
  }

  @GetMapping(value = "/metrics", produces = MediaType.TEXT_PLAIN_VALUE)
  public String metrics() {
    return registry.scrape();
  }
}
