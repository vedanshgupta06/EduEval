package com.edueval.controller;

import com.edueval.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    private static final DateTimeFormatter FILE_DATE =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * GET /api/teacher/reports/exam/{examId}
     * Downloads an Excel report for a single exam.
     */
    @GetMapping("/exam/{examId}")
    public ResponseEntity<byte[]> downloadExamReport(@PathVariable UUID examId) throws IOException {
        byte[] report = reportService.generateExamReport(examId);

        String filename = "EduEval_Exam_Report_" + LocalDateTime.now().format(FILE_DATE) + ".xlsx";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .body(report);
    }

    /**
     * GET /api/teacher/reports/classroom/{classroomId}
     * Downloads a combined Excel report for all exams in a classroom.
     * Each exam is a separate sheet.
     */
    @GetMapping("/classroom/{classroomId}")
    public ResponseEntity<byte[]> downloadClassroomReport(
            @PathVariable UUID classroomId
    ) throws IOException {
        byte[] report = reportService.generateClassroomReport(classroomId);

        String filename = "EduEval_Classroom_Report_" + LocalDateTime.now().format(FILE_DATE) + ".xlsx";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .body(report);
    }
}