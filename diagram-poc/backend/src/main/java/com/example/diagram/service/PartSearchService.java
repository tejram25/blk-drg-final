package com.example.diagram.service;

import java.util.Map;

/** Parts search (bundled sample catalogue). */
public interface PartSearchService {

    /**
     * Search the parts catalogue. Returns the raw {@code partserviceresult} JSON
     * (the same shape the frontend already renders into part cards).
     *
     * @param query     required search text (srchtxt)
     * @param supplier  optional supplier filter (suppname)
     * @param designWin whether to include design-win data (dw)
     */
    String search(String query, String supplier, boolean designWin);

    /**
     * Diagnostic for {@code GET /api/parts/health}: reports whether the service
     * can authenticate (and the resolved endpoints), without exposing secrets.
     */
    Map<String, Object> health();
}
