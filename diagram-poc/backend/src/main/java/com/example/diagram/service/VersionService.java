package com.example.diagram.service;

import com.example.diagram.web.dto.VersionDetail;
import com.example.diagram.web.dto.VersionRequest;
import com.example.diagram.web.dto.VersionSummary;

import java.util.List;

/** Version history (snapshots) for diagrams. */
public interface VersionService {

    VersionSummary snapshot(Long diagramId, VersionRequest request, String userEmail);

    List<VersionSummary> list(Long diagramId);

    VersionDetail get(Long versionId);
}
