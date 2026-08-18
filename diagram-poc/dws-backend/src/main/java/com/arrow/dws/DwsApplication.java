package com.arrow.dws;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Design Workspace backend.
 *
 * <p>Owns designs, the documents filed against them, and the approval that
 * decides what a customer may see. It does <b>not</b> own diagrams — those
 * belong to the block diagram service, which reaches this one over its API and
 * never writes its data.
 *
 * <p>Layering, outermost to innermost:
 *
 * <pre>
 *   api          controllers and wire DTOs        — knows HTTP
 *   application  use cases and tab contributors   — knows the workflow
 *   domain       model and ports                  — knows the business, nothing else
 *   adapter      implementations of the ports     — knows the outside world
 * </pre>
 *
 * <p>Dependencies point inwards. {@code domain} imports no Spring and no
 * Jackson, which is what lets the rules be tested without a container and
 * replaced underneath without touching them.
 */
@SpringBootApplication
public class DwsApplication {

    public static void main(String[] args) {
        SpringApplication.run(DwsApplication.class, args);
    }
}
