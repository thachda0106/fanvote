package com.eventista.commerce.health;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
// Boot 4 gotcha (T0.6): @AutoConfigureMockMvc moved to the webmvc test package
// and @SpringBootTest no longer supplies MockMvc without it.
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class HealthControllerTests {

  @Autowired private MockMvc mockMvc;

  @Test
  void healthzIsAlwaysOk() throws Exception {
    mockMvc
        .perform(get("/healthz"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ok"));
  }

  @Test
  void readyzReportsReadyWithChecksList() throws Exception {
    mockMvc
        .perform(get("/readyz"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ready"))
        .andExpect(jsonPath("$.checks").isArray());
  }

  @Test
  void metricsExposesPrometheusExposition() throws Exception {
    mockMvc
        .perform(get("/metrics"))
        .andExpect(status().isOk())
        .andExpect(content().string(org.hamcrest.Matchers.containsString("# HELP")));
  }
}
