package com.eventista.commerce.inventory;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class InventoryControllerTests {

  private static final String EVENT_ID = "3f0a1c2e-0000-4000-8000-000000000000";

  @Autowired private MockMvc mockMvc;

  @Test
  void inventoryStubReturnsSnapshot() throws Exception {
    mockMvc
        .perform(get("/api/v1/events/{eventId}/inventory", EVENT_ID))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.eventId").value(EVENT_ID))
        .andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.maxTicketsPerUser").value(2));
  }

  @Test
  void invalidEventIdReturnsValidationEnvelope() throws Exception {
    mockMvc
        .perform(get("/api/v1/events/not-a-uuid/inventory"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.requestId").exists());
  }
}
