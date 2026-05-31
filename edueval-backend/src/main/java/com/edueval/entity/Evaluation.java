package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "evaluations")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Evaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // One evaluation per submission
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false, unique = true)
    private Submission submission;

    // ── AI Results ────────────────────────────────────────────────────────────

    private Double aiMarks;

    // 0.0 to 1.0 — low confidence triggers a review warning on the teacher's UI
    private Double aiConfidence;

    // JSON string: keyword hits, missing points, sentence analysis
    // Stored as TEXT here; parse to Map/DTO in the service layer
    @Column(columnDefinition = "TEXT")
    private String aiFeedbackJson;

    // ── Teacher Review ────────────────────────────────────────────────────────

    // Null until teacher reviews — frontend shows "Pending Review" until set
    private Double teacherMarks;

    @Column(columnDefinition = "TEXT")
    private String teacherComment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    private LocalDateTime reviewedAt;

    // ── Derived ───────────────────────────────────────────────────────────────

    /**
     * Always use this for displaying marks to students.
     * Returns teacher marks if reviewed, otherwise AI marks.
     */
    @Transient
    public Double getFinalMarks() {
        return teacherMarks != null ? teacherMarks : aiMarks;
    }

    @Transient
    public boolean isReviewed() {
        return teacherMarks != null;
    }
}