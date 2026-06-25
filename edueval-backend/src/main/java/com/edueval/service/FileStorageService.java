package com.edueval.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private final Cloudinary cloudinary;

    public FileStorageService(
            @Value("${cloudinary.cloud-name}") String cloudName,
            @Value("${cloudinary.api-key}") String apiKey,
            @Value("${cloudinary.api-secret}") String apiSecret
    ) {
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret
        ));
    }

    /**
     * Uploads file to Cloudinary and returns the public_id.
     * This replaces the old relative path as the stored reference.
     */
    public String store(MultipartFile file, String subDirectory) {
        validateFile(file);
        try {
            Map result = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "folder", "edueval/" + subDirectory,
                    "resource_type", "auto"
            ));
            return (String) result.get("secure_url");  // ← was: "public_id"
        } catch (IOException e) {
            throw new IllegalStateException("Failed to upload file to Cloudinary", e);
        }
    }


    public void delete(String publicId) {
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "auto"));
        } catch (IOException e) {
            System.err.println("Warning: could not delete from Cloudinary: " + publicId);
        }
    }

    /**
     * Returns a secure URL for the given public_id.
     * Pass this URL to FastAPI instead of a local file path.
     */
  public String resolve(String publicId) {
    return cloudinary.url()
            .resourceType("raw")  // works for both PDFs and images
            .secure(true)
            .generate(publicId);
}
    private void validateFile(MultipartFile file) {
    if (file == null || file.isEmpty()) {
        throw new IllegalArgumentException("File must not be empty");
    }
    String contentType = file.getContentType();
    if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
        throw new IllegalArgumentException(
            "Unsupported file type: " + contentType +
            ". Allowed: PDF, JPEG, PNG, WEBP"
        );
    }
}
}