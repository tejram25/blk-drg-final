package com.example.diagram.service;

import java.util.List;
import java.util.Map;

/**
 * Supplies the block/shape palette that feeds the Angular toolbox. Kept behind an
 * interface so the catalog source (hardcoded today, a table tomorrow) can change
 * without touching the controller.
 */
public interface BlockCatalogService {

    List<Map<String, String>> blockTypes();
}
