package com.arrow.dws.api;

import com.arrow.dws.api.dto.ArtifactListView;
import com.arrow.dws.application.ArtifactService;
import com.arrow.dws.domain.model.Audience;
import com.arrow.dws.domain.model.RenderedArtifact;

import jakarta.validation.constraints.NotBlank;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The artifacts of a design: diagrams as PNG, everything else as PDF or
 * spreadsheet.
 *
 * <p>Two endpoints rather than one. The list is metadata — names, sizes,
 * download URLs — so a client can draw a file list without pulling megabytes;
 * the download returns one file with the right {@code Content-Type}. Putting
 * bytes in the list would mean base64-inflating every artifact on every call,
 * for a client that mostly wants to render rows.
 *
 * <p>Both live under the opportunity, so the audience filter applies in one
 * place and a download cannot be reached by guessing an id alone.
 */
@RestController
@RequestMapping("/api/sfdc/opportunities/{opportunityId}/artifacts")
@Validated
public class ArtifactController {

    private final ArtifactService artifacts;

    public ArtifactController(ArtifactService artifacts) {
        this.artifacts = artifacts;
    }

    /**
     * Every artifact this audience may see.
     *
     * @param embed {@code true} — the default — restricts the list to
     *              customer-visible artifacts. Internal ones are absent from
     *              the response, not marked and returned.
     */
    @GetMapping
    public ArtifactListView list(
            @PathVariable @NotBlank String opportunityId,
            @RequestParam(name = "embed", defaultValue = "true") boolean embed) {
        return artifacts.listArtifacts(opportunityId, audience(embed));
    }

    /**
     * One artifact's bytes.
     *
     * <p>Images and PDFs are sent {@code inline} so a browser shows them — a
     * PNG can go straight into an {@code <img src>}. Spreadsheets are sent as
     * an attachment, because a browser cannot render one and would otherwise
     * display bytes.
     */
    @GetMapping("/{artifactId}")
    public ResponseEntity<Resource> download(
            @PathVariable @NotBlank String opportunityId,
            @PathVariable @NotBlank String artifactId,
            @RequestParam(name = "embed", defaultValue = "true") boolean embed) {

        RenderedArtifact rendered = artifacts.downloadArtifact(opportunityId, audience(embed), artifactId);
        var artifact = rendered.artifact();
        byte[] content = rendered.content();

        // No charset on purpose. Passing one makes Spring encode the plain
        // `filename` parameter as an RFC 2047 word — `=?UTF-8?Q?...?=` — which
        // browsers ignore in favour of `filename*`, but curl and most HTTP
        // client libraries do not: they read `filename` and save the literal
        // encoded string as the file's name. ArtifactCatalogue already strips
        // filenames to ASCII, so the unencoded form is both correct and the one
        // every client can read. ArtifactControllerTest pins this.
        ContentDisposition disposition = (artifact.format().rendersInline()
                ? ContentDisposition.inline()
                : ContentDisposition.attachment())
                .filename(artifact.fileName())
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(artifact.format().mediaType()))
                .contentLength(content.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                // The fixture is immutable, but a real design is not. No-store
                // rather than a max-age nobody can invalidate: a stale approved
                // document is the one thing this API must not serve.
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(new ByteArrayResource(content));
    }

    private static Audience audience(boolean embed) {
        return embed ? Audience.EMBEDDED : Audience.INTERNAL;
    }
}
