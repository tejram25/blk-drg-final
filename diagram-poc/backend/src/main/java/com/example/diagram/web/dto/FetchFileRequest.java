package com.example.diagram.web.dto;

/**
 * Pull a file into a project from a URL (e.g. a part datasheet), storing a local
 * copy so the workspace no longer links out to another site.
 *
 * @param url    source to download
 * @param name   file name to store it under (falls back to the URL's last segment)
 * @param folder tree folder (defaults to Documents)
 */
public record FetchFileRequest(String url, String name, String folder) {}
