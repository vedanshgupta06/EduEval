package com.edueval.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "classrooms")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Classroom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String className;

    // The teacher who owns this classroom
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    // Auto-generated unique join code e.g. "CS101-A4X"
    @Column(nullable = false, unique = true)
    private String classCode;

    @Builder.Default
    private boolean archived = false;

    @CreationTimestamp
    private LocalDateTime createdAt;
}