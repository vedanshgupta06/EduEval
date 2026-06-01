package com.edueval.service;

import com.edueval.entity.Evaluation;
import com.edueval.entity.Exam;
import com.edueval.entity.Submission;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.EvaluationRepository;
import com.edueval.repository.ExamRepository;
import com.edueval.repository.SubmissionRepository;
import com.edueval.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ExamRepository examRepository;
    private final SubmissionRepository submissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    /**
     * Generates an Excel report for a single exam.
     * Only the teacher who owns the classroom can download it.
     */
    public byte[] generateExamReport(UUID examId) throws IOException {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found: " + examId));

        // Verify ownership
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        var teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!exam.getClassroom().getTeacher().getId().equals(teacher.getId())) {
            throw new UnauthorizedActionException("You do not own this exam");
        }

        List<Submission> submissions = submissionRepository.findByExam(exam);

        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Marks Report");

            // ── Styles ────────────────────────────────────────────────────

            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.INDIGO.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            dataStyle.setAlignment(HorizontalAlignment.LEFT);

            CellStyle numberStyle = workbook.createCellStyle();
            numberStyle.setBorderBottom(BorderStyle.THIN);
            numberStyle.setBorderLeft(BorderStyle.THIN);
            numberStyle.setBorderRight(BorderStyle.THIN);
            numberStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle pendingStyle = workbook.createCellStyle();
            Font pendingFont = workbook.createFont();
            pendingFont.setColor(IndexedColors.ORANGE.getIndex());
            pendingStyle.setFont(pendingFont);
            pendingStyle.setBorderBottom(BorderStyle.THIN);
            pendingStyle.setBorderLeft(BorderStyle.THIN);
            pendingStyle.setBorderRight(BorderStyle.THIN);
            pendingStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle reviewedStyle = workbook.createCellStyle();
            Font reviewedFont = workbook.createFont();
            reviewedFont.setColor(IndexedColors.GREEN.getIndex());
            reviewedStyle.setFont(reviewedFont);
            reviewedStyle.setBorderBottom(BorderStyle.THIN);
            reviewedStyle.setBorderLeft(BorderStyle.THIN);
            reviewedStyle.setBorderRight(BorderStyle.THIN);
            reviewedStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle altRowStyle = workbook.createCellStyle();
            altRowStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            altRowStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            altRowStyle.setBorderBottom(BorderStyle.THIN);
            altRowStyle.setBorderLeft(BorderStyle.THIN);
            altRowStyle.setBorderRight(BorderStyle.THIN);
            altRowStyle.setAlignment(HorizontalAlignment.LEFT);

            CellStyle altNumberStyle = workbook.createCellStyle();
            altNumberStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            altNumberStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            altNumberStyle.setBorderBottom(BorderStyle.THIN);
            altNumberStyle.setBorderLeft(BorderStyle.THIN);
            altNumberStyle.setBorderRight(BorderStyle.THIN);
            altNumberStyle.setAlignment(HorizontalAlignment.CENTER);

            // ── Title rows ────────────────────────────────────────────────

            int rowNum = 0;

            Row titleRow = sheet.createRow(rowNum++);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("EduEval — Marks Report");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 7));

            Row examRow = sheet.createRow(rowNum++);
            examRow.createCell(0).setCellValue("Exam:");
            examRow.createCell(1).setCellValue(exam.getTitle());
            examRow.createCell(3).setCellValue("Classroom:");
            examRow.createCell(4).setCellValue(exam.getClassroom().getClassName());

            Row metaRow = sheet.createRow(rowNum++);
            metaRow.createCell(0).setCellValue("Total Marks:");
            metaRow.createCell(1).setCellValue(exam.getTotalMarks());
            metaRow.createCell(3).setCellValue("Deadline:");
            metaRow.createCell(4).setCellValue(exam.getDeadline().format(DATE_FMT));

            Row teacherRow = sheet.createRow(rowNum++);
            teacherRow.createCell(0).setCellValue("Teacher:");
            teacherRow.createCell(1).setCellValue(teacher.getName());
            teacherRow.createCell(3).setCellValue("Total Submissions:");
            teacherRow.createCell(4).setCellValue(submissions.size());

            rowNum++; // blank row

            // ── Header row ────────────────────────────────────────────────

            Row headerRow = sheet.createRow(rowNum++);
            headerRow.setHeightInPoints(20);
            String[] headers = {
                    "#", "Student Name", "Submitted At",
                    "AI Marks", "Teacher Marks", "Final Marks",
                    "Out of", "Status"
            };
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // ── Data rows ─────────────────────────────────────────────────

            int sNo = 1;
            double totalFinalMarks = 0;
            int reviewedCount = 0;

            for (Submission sub : submissions) {
                boolean isAlt = (sNo % 2 == 0);
                Row row = sheet.createRow(rowNum++);

                var eval = evaluationRepository.findBySubmission(sub).orElse(null);

                Double aiMarks      = eval != null ? eval.getAiMarks()      : null;
                Double teacherMarks = eval != null ? eval.getTeacherMarks() : null;
                Double finalMarks   = eval != null ? eval.getFinalMarks()   : null;
                boolean reviewed    = eval != null && eval.isReviewed();

                // Serial number
                Cell noCell = row.createCell(0);
                noCell.setCellValue(sNo);
                noCell.setCellStyle(isAlt ? altNumberStyle : numberStyle);

                // Student name
                Cell nameCell = row.createCell(1);
                nameCell.setCellValue(sub.getStudent().getName());
                nameCell.setCellStyle(isAlt ? altRowStyle : dataStyle);

                // Submitted at
                Cell dateCell = row.createCell(2);
                dateCell.setCellValue(sub.getSubmittedAt().format(DATE_FMT));
                dateCell.setCellStyle(isAlt ? altRowStyle : dataStyle);

                // AI marks
                Cell aiCell = row.createCell(3);
                if (aiMarks != null) {
                    aiCell.setCellValue(Math.round(aiMarks * 10.0) / 10.0);
                } else {
                    aiCell.setCellValue("—");
                }
                aiCell.setCellStyle(isAlt ? altNumberStyle : numberStyle);

                // Teacher marks
                Cell teacherCell = row.createCell(4);
                if (teacherMarks != null) {
                    teacherCell.setCellValue(Math.round(teacherMarks * 10.0) / 10.0);
                } else {
                    teacherCell.setCellValue("—");
                }
                teacherCell.setCellStyle(isAlt ? altNumberStyle : numberStyle);

                // Final marks
                Cell finalCell = row.createCell(5);
                if (finalMarks != null) {
                    finalCell.setCellValue(Math.round(finalMarks * 10.0) / 10.0);
                    totalFinalMarks += finalMarks;
                } else {
                    finalCell.setCellValue("—");
                }
                finalCell.setCellStyle(isAlt ? altNumberStyle : numberStyle);

                // Out of
                Cell outOfCell = row.createCell(6);
                outOfCell.setCellValue(exam.getTotalMarks());
                outOfCell.setCellStyle(isAlt ? altNumberStyle : numberStyle);

                // Status
                Cell statusCell = row.createCell(7);
                statusCell.setCellValue(sub.getStatus().name().replace("_", " "));
                statusCell.setCellStyle(reviewed ? reviewedStyle : pendingStyle);

                if (reviewed) reviewedCount++;
                sNo++;
            }

            // ── Summary row ───────────────────────────────────────────────

            rowNum++; // blank row
            Row summaryRow = sheet.createRow(rowNum++);

            CellStyle summaryStyle = workbook.createCellStyle();
            Font summaryFont = workbook.createFont();
            summaryFont.setBold(true);
            summaryStyle.setFont(summaryFont);
            summaryStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            summaryStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            summaryStyle.setBorderTop(BorderStyle.MEDIUM);

            Cell summaryLabel = summaryRow.createCell(0);
            summaryLabel.setCellValue("Class Average");
            summaryLabel.setCellStyle(summaryStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowNum - 1, rowNum - 1, 0, 4));

            Cell avgCell = summaryRow.createCell(5);
            int evaluated = submissions.stream()
                    .mapToInt(s -> evaluationRepository.findBySubmission(s)
                            .map(e -> e.getFinalMarks() != null ? 1 : 0).orElse(0))
                    .sum();
            if (evaluated > 0) {
                double avg = totalFinalMarks / evaluated;
                avgCell.setCellValue(Math.round(avg * 10.0) / 10.0);
            } else {
                avgCell.setCellValue("—");
            }
            avgCell.setCellStyle(summaryStyle);

            Cell outOfSummary = summaryRow.createCell(6);
            outOfSummary.setCellValue(exam.getTotalMarks());
            outOfSummary.setCellStyle(summaryStyle);

            Cell reviewedSummary = summaryRow.createCell(7);
            reviewedSummary.setCellValue(reviewedCount + " / " + submissions.size() + " reviewed");
            reviewedSummary.setCellStyle(summaryStyle);

            // ── Column widths ─────────────────────────────────────────────

            sheet.setColumnWidth(0, 8 * 256);    // #
            sheet.setColumnWidth(1, 25 * 256);   // name
            sheet.setColumnWidth(2, 22 * 256);   // submitted at
            sheet.setColumnWidth(3, 14 * 256);   // AI marks
            sheet.setColumnWidth(4, 16 * 256);   // teacher marks
            sheet.setColumnWidth(5, 14 * 256);   // final marks
            sheet.setColumnWidth(6, 10 * 256);   // out of
            sheet.setColumnWidth(7, 18 * 256);   // status

            // ── Freeze header ─────────────────────────────────────────────
            sheet.createFreezePane(0, 6); // freeze title + header rows

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Generates a combined report for all exams in a classroom.
     * Each exam gets its own sheet.
     */
    public byte[] generateClassroomReport(UUID classroomId) throws IOException {
        var classroom = examRepository.findAll().stream()
                .filter(e -> e.getClassroom().getId().equals(classroomId))
                .map(Exam::getClassroom)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found"));

        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        var teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!classroom.getTeacher().getId().equals(teacher.getId())) {
            throw new UnauthorizedActionException("You do not own this classroom");
        }

        // For classroom report, generate per-exam sheets
        // Reuse exam report logic per exam
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            var exams = examRepository.findByClassroom(classroom);

            if (exams.isEmpty()) {
                Sheet sheet = workbook.createSheet("No Exams");
                sheet.createRow(0).createCell(0).setCellValue("No exams found for this classroom.");
            }

            for (Exam exam : exams) {
                // Generate individual exam data into a sheet
                Sheet sheet = workbook.createSheet(
                        exam.getTitle().length() > 30
                                ? exam.getTitle().substring(0, 30)
                                : exam.getTitle()
                );

                List<Submission> submissions = submissionRepository.findByExam(exam);

                Row headerRow = sheet.createRow(0);
                String[] headers = {"#", "Student Name", "Submitted At", "AI Marks", "Teacher Marks", "Final Marks", "Out of", "Status"};
                for (int i = 0; i < headers.length; i++) {
                    headerRow.createCell(i).setCellValue(headers[i]);
                }

                int rowNum = 1;
                int sNo = 1;
                for (Submission sub : submissions) {
                    Row row = sheet.createRow(rowNum++);
                    var eval = evaluationRepository.findBySubmission(sub).orElse(null);

                    row.createCell(0).setCellValue(sNo++);
                    row.createCell(1).setCellValue(sub.getStudent().getName());
                    row.createCell(2).setCellValue(sub.getSubmittedAt().format(DATE_FMT));
                    row.createCell(3).setCellValue(eval != null && eval.getAiMarks() != null ? eval.getAiMarks() : 0);
                    row.createCell(4).setCellValue(eval != null && eval.getTeacherMarks() != null ? eval.getTeacherMarks() : 0);
                    row.createCell(5).setCellValue(eval != null && eval.getFinalMarks() != null ? eval.getFinalMarks() : 0);
                    row.createCell(6).setCellValue(exam.getTotalMarks());
                    row.createCell(7).setCellValue(sub.getStatus().name().replace("_", " "));
                }

                for (int i = 0; i < 8; i++) sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }
}