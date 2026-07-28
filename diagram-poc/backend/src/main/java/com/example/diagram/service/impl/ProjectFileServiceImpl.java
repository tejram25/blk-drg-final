package com.example.diagram.service.impl;

import com.example.diagram.domain.ProjectFile;
import com.example.diagram.repository.ProjectFileRepository;
import com.example.diagram.service.ProjectFileService;
import com.example.diagram.web.dto.FetchFileRequest;
import com.example.diagram.web.dto.ProjectFileDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.List;
import java.util.Optional;

/**
 * Downloads and stores project files. Uses {@link RestClient}, which honours the
 * JVM proxy settings, so it works in proxied environments the same as the
 * catalogue calls.
 */
@Service
public class ProjectFileServiceImpl implements ProjectFileService {

    private static final Logger log = LoggerFactory.getLogger(ProjectFileServiceImpl.class);
    /** Guard against pulling something huge into an H2 BLOB. */
    private static final long MAX_BYTES = 25L * 1024 * 1024;

    private final ProjectFileRepository repo;
    private final RestClient http = RestClient.create();

    public ProjectFileServiceImpl(ProjectFileRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProjectFileDto> list(String projectId) {
        return repo.findByProjectIdOrderByNameAsc(projectId).stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public ProjectFileDto fetch(String projectId, FetchFileRequest request, String userEmail) {
        if (request == null || request.url() == null || request.url().isBlank()) {
            throw new IllegalArgumentException("A source url is required.");
        }
        String url = request.url().trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new IllegalArgumentException("Only http(s) sources can be fetched.");
        }
        // Already fetched for this project? Return the stored copy, don't re-download.
        Optional<ProjectFile> existing = repo.findByProjectIdAndSourceUrl(projectId, url);
        if (existing.isPresent()) return toDto(existing.get());

        ResponseEntity<byte[]> response;
        try {
            response = http.get().uri(URI.create(url)).retrieve().toEntity(byte[].class);
        } catch (Exception ex) {
            log.warn("Could not fetch {} for project {}: {}", url, projectId, ex.toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not download that file from its source.");
        }
        byte[] bytes = response.getBody();
        if (bytes == null || bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The source returned no content.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "That file is too large to store (" + (bytes.length / 1_048_576) + " MB).");
        }

        ProjectFile file = new ProjectFile();
        file.setProjectId(projectId);
        file.setName(resolveName(request.name(), url));
        file.setFolder(request.folder() == null || request.folder().isBlank() ? "Documents" : request.folder());
        String contentType = response.getHeaders().getContentType() != null
                ? response.getHeaders().getContentType().toString() : "application/octet-stream";
        file.setContentType(contentType);
        file.setSizeBytes(bytes.length);
        file.setSourceUrl(url);
        file.setLinkedBy(userEmail);
        file.setBytes(bytes);
        return toDto(repo.save(file));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProjectFile> content(String projectId, Long fileId) {
        return repo.findByIdAndProjectId(fileId, projectId);
    }

    @Override
    @Transactional
    public void delete(String projectId, Long fileId) {
        repo.findByIdAndProjectId(fileId, projectId).ifPresent(repo::delete);
    }

    /** Prefer the caller's name; otherwise the URL's last path segment. */
    private String resolveName(String name, String url) {
        if (name != null && !name.isBlank()) return name.trim();
        String path = URI.create(url).getPath();
        int slash = path.lastIndexOf('/');
        String last = slash >= 0 ? path.substring(slash + 1) : path;
        return last.isBlank() ? "download" : last;
    }

    private ProjectFileDto toDto(ProjectFile f) {
        return new ProjectFileDto(f.getId(), f.getName(), f.getFolder(),
                f.getContentType(), f.getSizeBytes(), f.getSourceUrl(), f.getLinkedBy());
    }
}
