package com.edueval.entity;

import com.edueval.enums.QuestionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "assessment_questions", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"assessment_id", "question_no"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AssessmentQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    @Column(name = "question_no", nullable = false)
    private Integer questionNo;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false)
    private QuestionType questionType;

    @Column(nullable = false)
    private Integer marks;

    // JSON array of option strings — only for MCQ and MULTI_SELECT
    // e.g. ["Option A", "Option B", "Option C", "Option D"]
    @Column(name = "options", columnDefinition = "TEXT")
    private String options;

    // JSON array of correct option indices (0-based)
    // MCQ:          [1]
    // MULTI_SELECT: [0, 2]
    // DESCRIPTIVE:  null
    @Column(name = "correct_answers", columnDefinition = "TEXT")
    private String correctAnswers;

    // For DESCRIPTIVE questions — used by AI engine as reference
    @Column(name = "model_answer_text", columnDefinition = "TEXT")
    private String modelAnswerText;

    // For MULTI_SELECT: PROPORTIONAL = partial credit, STRICT = all-or-nothing
    @Column(name = "scoring_mode")
    @Builder.Default
    private String scoringMode = "PROPORTIONAL";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
