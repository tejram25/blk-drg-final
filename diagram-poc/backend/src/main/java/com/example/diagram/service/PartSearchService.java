package com.example.diagram.service;

/** Proxies the Arrow Design Win Part Search API. */
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
}
