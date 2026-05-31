package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record ClassroomResponse(
        UUID id,
        String className,
        String classCode,
        String teacherName,
        long studentCount,
        long examCount,
        boolean archived,
        LocalDateTime createdAt
) {}
