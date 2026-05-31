package com.edueval.exception;

// Thrown when an action is not permitted for the current user
public class UnauthorizedActionException extends RuntimeException {
    public UnauthorizedActionException(String message) {
        super(message);
    }
}