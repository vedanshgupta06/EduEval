package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "question_evaluations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class QuestionEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_submission_id", nullable = false, unique = true)
    private QuestionSubmission questionSubmission;

    @Column(name = "ai_marks")
    private Double aiMarks;

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Column(name = "ai_feedback_json", columnDefinition = "TEXT")
    private String aiFeedbackJson;

    @Column(name = "teacher_marks")
    private Double teacherMarks;

    @Column(name = "teacher_comment")
    private String teacherComment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;
}