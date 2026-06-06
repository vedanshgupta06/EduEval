package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "exams")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private Integer totalMarks;

    @Column(nullable = false)
    private LocalDateTime deadline;

    @Column(name = "is_multi_question", nullable = false)
    @Builder.Default
    private Boolean isMultiQuestion = false;
 
    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("questionNo ASC")
    private List<ExamQuestion> questions = new ArrayList<>();

    // Path to uploaded model answer file (PDF/image)
    private String modelAnswerUrl;

    // Optional typed model answer — used directly by AI engine
    @Column(columnDefinition = "TEXT")
    private String modelAnswerText;

    @CreationTimestamp
    private LocalDateTime createdAt;
}