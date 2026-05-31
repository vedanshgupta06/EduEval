package com.edueval.exception;

// Thrown when a requested resource is not found (404)
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}