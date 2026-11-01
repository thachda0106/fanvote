package com.eventista.commerce.health;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Observability-only surface (T0.5): /healthz liveness is datastore-
 * independent; /readyz returns 503 when degraded (D-12 — checks land Phase 6);
 * /metrics exposes a minimal Prometheus exposition (full RED in Phase 8).
 */
@RestController
public class HealthController {

  @GetMapping("/healthz")
  public Map<String, String> healthz() {
    return Map.of("status", "ok");
  }

  @GetMapping("/readyz")
  public Map<String, Object> readyz() {
    // Phase 0: no datastore checks yet — never boot-fail on a blip (R-17).
    return Map.of("status", "ready", "checks", List.of());
  }

  @GetMapping(value = "/metrics", produces = MediaType.TEXT_PLAIN_VALUE)
  public String metrics() {
    return """
        # HELP up 1 if the process is running
        # TYPE up gauge
        up 1
        """;
  }
}
