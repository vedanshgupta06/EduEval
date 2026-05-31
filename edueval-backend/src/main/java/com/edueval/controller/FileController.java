package com.edueval.controller;

import com.edueval.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final Path uploadRoot;

    public FileController(@Value("${app.file-storage.upload-dir}") String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    /**
     * GET /api/files/submissions/{examId}/{filename}
     * Serves any file stored under the upload root.
     * Requires authentication — handled by SecurityConfig.
     */
    @GetMapping("/**")
    public ResponseEntity<Resource> serveFile(HttpServletRequest request) {
        // Extract path after /api/files/
        String requestPath = request.getRequestURI();
        String relativePath = requestPath.substring("/api/files/".length());

        try {
            Path filePath = uploadRoot.resolve(relativePath).normalize();

            // Security: prevent path traversal attacks
            if (!filePath.startsWith(uploadRoot)) {
                throw new ResourceNotFoundException("Access denied");
            }

            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("File not found: " + relativePath);
            }

            // Determine content type
            String contentType = request.getServletContext()
                    .getMimeType(resource.getFile().getAbsolutePath());
            if (contentType == null) {
                contentType = "application/octet-stream";
            }

            log.info("Serving file: {}", relativePath);

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + resource.getFilename() + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("Invalid file path: " + relativePath);
        } catch (ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error serving file {}: {}", relativePath, e.getMessage());
            throw new ResourceNotFoundException("Could not serve file: " + relativePath);
        }
    }
}
