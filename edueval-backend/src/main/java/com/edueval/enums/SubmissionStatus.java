package com.edueval.enums;

public enum SubmissionStatus {
    PENDING,        // submitted, not yet sent to AI
    PROCESSING,     // AI engine is evaluating
    AI_EVALUATED,   // AI done, awaiting teacher review
    REVIEWED,       // teacher has reviewed and finalized marks
    RESUBMIT        // teacher flagged for student resubmission
}