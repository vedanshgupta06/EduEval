package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "question_submissions", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"submission_id", "question_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class QuestionSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private ExamQuestion question;

    @Column(name = "file_url")
    private String fileUrl;

    // PENDING | PROCESSING | AI_EVALUATED | REVIEWED
    @Column(nullable = false)
    private String status = "PENDING";

    @Column(name = "submitted_at")
    @CreationTimestamp
    private LocalDateTime submittedAt;
}