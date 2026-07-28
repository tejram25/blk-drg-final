package com.example.diagram.web;

import com.example.diagram.domain.ProjectFile;
import com.example.diagram.service.ProjectFileService;
import com.example.diagram.web.dto.FetchFileRequest;
import com.example.diagram.web.dto.ProjectFileDto;
import com.example.diagram.web.error.NotFoundException;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Files stored against a project — datasheets and the like, pulled in from a URL
 * so the workspace serves its own copy instead of linking out. Thin: delegates
 * to the service layer.
 */
@RestController
@RequestMapping("/api/workspace/projects/{projectId}/files")
public class ProjectFileController {

    private final ProjectFileService files;

    public ProjectFileController(ProjectFileService files) {
        this.files = files;
    }

    @GetMapping
    public List<ProjectFileDto> list(@PathVariable String projectId) {
        return files.list(projectId);
    }

    /** Download a URL into the project and store it. 201 with the stored metadata. */
    @PostMapping("/fetch")
    public ResponseEntity<ProjectFileDto> fetch(@PathVariable String projectId,
                                                @RequestBody FetchFileRequest request,
                                                Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(files.fetch(projectId, request, emailOf(auth)));
    }

    /** The stored bytes, served inline so the app can render (e.g. a PDF) in place. */
    @GetMapping("/{fileId}/content")
    public ResponseEntity<Resource> content(@PathVariable String projectId, @PathVariable Long fileId) {
        ProjectFile file = files.content(projectId, fileId)
                .orElseThrow(() -> new NotFoundException("File not found: " + fileId));
        MediaType type = file.getContentType() != null
                ? MediaType.parseMediaType(file.getContentType()) : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .body(new ByteArrayResource(file.getBytes() == null ? new byte[0] : file.getBytes()));
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<Void> delete(@PathVariable String projectId, @PathVariable Long fileId) {
        files.delete(projectId, fileId);
        return ResponseEntity.noContent().build();
    }

    private String emailOf(Authentication auth) {
        return auth == null ? "anonymous" : auth.getName();
    }
}
