package com.eventista.commerce;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CommerceApplication {

  public static void main(String[] args) {
    // Boot 4 gotcha (README/T0.6): run with -Duser.timezone=UTC
    SpringApplication.run(CommerceApplication.class, args);
  }
}
