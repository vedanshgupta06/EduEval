package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "assessment_submissions", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"student_id", "assessment_id"})
        // One submission per student per assessment
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AssessmentSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;

    // Auto-graded total (MCQ + multi-select calculated instantly, descriptive after AI)
    private Double totalMarksObtained;

    // PENDING | GRADED | PARTIALLY_GRADED (when descriptive AI is still running)
    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    @Builder.Default
    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<AssessmentAnswer> answers = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime submittedAt;
}
