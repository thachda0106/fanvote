package com.eventista.commerce.inventory;

import com.eventista.commerce.common.ApiError;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inventory read stub (T1.5/T1.6): proves a real contract route through the
 * gateway without a datastore (Phase 3 replaces the fixed snapshot with PG).
 */
@RestController
public class InventoryController {

  private static final Pattern UUID =
      Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", Pattern.CASE_INSENSITIVE);

  @GetMapping("/api/v1/events/{eventId}/inventory")
  public Map<String, Object> inventory(@PathVariable String eventId) {
    if (!UUID.matcher(eventId).matches()) {
      throw new ApiError(ApiError.Code.VALIDATION_FAILED, "eventId must be a uuid");
    }
    return Map.of(
        "eventId",
        eventId,
        "items",
        List.of(
            Map.of(
                "id", "11111111-1111-4111-8111-111111111111",
                "section", "GA",
                "price", Map.of("currency", "VND", "amount", 500_000),
                "totalTickets", 500,
                "availableTickets", 500,
                "saleOpensAt", "2026-01-01T00:00:00Z",
                "saleClosesAt", "2027-01-01T00:00:00Z"),
            Map.of(
                "id", "22222222-2222-4222-8222-222222222222",
                "section", "VIP",
                "price", Map.of("currency", "VND", "amount", 1_500_000),
                "totalTickets", 50,
                "availableTickets", 50,
                "saleOpensAt", "2026-01-01T00:00:00Z",
                "saleClosesAt", "2027-01-01T00:00:00Z")),
        "maxTicketsPerUser",
        2);
  }
}
