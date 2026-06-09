package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "assessment_answers", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"submission_id", "question_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AssessmentAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private AssessmentSubmission submission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private AssessmentQuestion question;

    // MCQ/MULTI_SELECT: JSON array of chosen indices e.g. [2] or [0,2]
    // DESCRIPTIVE:      plain text answer
    @Column(name = "answer_value", columnDefinition = "TEXT")
    private String answerValue;

    // Marks awarded for this answer (set by grading service)
    @Column(name = "marks_obtained")
    private Double marksObtained;

    // AI feedback JSON — only populated for DESCRIPTIVE
    @Column(name = "ai_feedback_json", columnDefinition = "TEXT")
    private String aiFeedbackJson;

    // AI confidence 0.0–1.0 — only for DESCRIPTIVE
    private Double aiConfidence;

    // Teacher can override marks for DESCRIPTIVE answers
    @Column(name = "teacher_marks")
    private Double teacherMarks;

    @Column(name = "teacher_comment")
    private String teacherComment;

    @Transient
    public Double getFinalMarks() {
        return teacherMarks != null ? teacherMarks : marksObtained;
    }
}
