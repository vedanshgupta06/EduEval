package com.edueval.service;

import com.edueval.entity.*;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssessmentReportService {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentSubmissionRepository submissionRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    /**
     * Generates an Excel report for an assessment.
     * Columns: Student Name | Email | Q1 (/marks) | Q2 (/marks) | ... | Total | Max | %
     */
    public byte[] generateAssessmentReport(UUID assessmentId) throws IOException {
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment not found: " + assessmentId));

        requireOwnership(assessment);

        List<AssessmentQuestion> questions =
                questionRepository.findByAssessmentIdOrderByQuestionNoAsc(assessmentId);

        List<AssessmentSubmission> submissions =
                submissionRepository.findByAssessmentIdWithAnswers(assessmentId);

        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Assessment Results");

            // ── Styles ────────────────────────────────────────────────────────
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font whiteFont = workbook.createFont();
            whiteFont.setBold(true);
            whiteFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(whiteFont);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle subHeaderStyle = workbook.createCellStyle();
            Font subFont = workbook.createFont();
            subFont.setBold(true);
            subHeaderStyle.setFont(subFont);
            subHeaderStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            subHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            subHeaderStyle.setBorderBottom(BorderStyle.THIN);
            subHeaderStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);

            CellStyle numStyle = workbook.createCellStyle();
            numStyle.cloneStyleFrom(dataStyle);
            numStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle boldStyle = workbook.createCellStyle();
            Font bold = workbook.createFont();
            bold.setBold(true);
            boldStyle.setFont(bold);
            boldStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle percentStyle = workbook.createCellStyle();
            percentStyle.cloneStyleFrom(boldStyle);

            // ── Row 0: Title ──────────────────────────────────────────────────
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("EduEval — Assessment Report: " + assessment.getTitle());
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);
            titleCell.setCellStyle(titleStyle);
            int totalCols = 2 + questions.size() + 3; // name, email, Qs, total, max, %
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, totalCols - 1));

            // ── Row 1: Meta ───────────────────────────────────────────────────
            Row metaRow = sheet.createRow(1);
            metaRow.createCell(0).setCellValue("Deadline: " + assessment.getDeadline().format(DATE_FMT));
            metaRow.createCell(2).setCellValue("Total Marks: " + assessment.getTotalMarks());
            metaRow.createCell(4).setCellValue("Submissions: " + submissions.size());

            // ── Row 2: blank ──────────────────────────────────────────────────
            sheet.createRow(2);

            // ── Row 3: Headers ────────────────────────────────────────────────
            Row headerRow = sheet.createRow(3);
            int col = 0;
            createHeaderCell(headerRow, col++, "Student Name", headerStyle);
            createHeaderCell(headerRow, col++, "Email", headerStyle);

            for (AssessmentQuestion q : questions) {
                String label = "Q" + q.getQuestionNo()
                        + " [" + q.getQuestionType().name() + "] /" + q.getMarks();
                createHeaderCell(headerRow, col++, label, subHeaderStyle);
            }
            createHeaderCell(headerRow, col++, "Total Obtained", headerStyle);
            createHeaderCell(headerRow, col++, "Max Marks", headerStyle);
            createHeaderCell(headerRow, col, "Percentage", headerStyle);

            // ── Data rows ────────────────────────────────────────────────────
            // Build a map: submissionId → (questionId → answer) for quick lookup
            int rowIdx = 4;
            for (AssessmentSubmission sub : submissions) {
                Map<UUID, AssessmentAnswer> answerMap = sub.getAnswers().stream()
                        .collect(Collectors.toMap(
                                a -> a.getQuestion().getId(),
                                a -> a,
                                (a, b) -> a
                        ));

                Row row = sheet.createRow(rowIdx++);
                col = 0;

                Cell nameCell = row.createCell(col++);
                nameCell.setCellValue(sub.getStudent().getName());
                nameCell.setCellStyle(dataStyle);

                Cell emailCell = row.createCell(col++);
                emailCell.setCellValue(sub.getStudent().getEmail());
                emailCell.setCellStyle(dataStyle);

                for (AssessmentQuestion q : questions) {
                    AssessmentAnswer answer = answerMap.get(q.getId());
                    Cell c = row.createCell(col++);
                    if (answer != null && answer.getFinalMarks() != null) {
                        c.setCellValue(answer.getFinalMarks());
                    } else {
                        c.setCellValue("-");
                    }
                    c.setCellStyle(numStyle);
                }

                double total = sub.getTotalMarksObtained() != null ? sub.getTotalMarksObtained() : 0.0;
                Cell totalCell = row.createCell(col++);
                totalCell.setCellValue(total);
                totalCell.setCellStyle(boldStyle);

                Cell maxCell = row.createCell(col++);
                maxCell.setCellValue(assessment.getTotalMarks());
                maxCell.setCellStyle(numStyle);

                Cell pctCell = row.createCell(col);
                double pct = assessment.getTotalMarks() > 0
                        ? Math.round((total / assessment.getTotalMarks()) * 1000.0) / 10.0
                        : 0.0;
                pctCell.setCellValue(pct + "%");
                pctCell.setCellStyle(percentStyle);
            }

            // ── Auto-size columns ────────────────────────────────────────────
            for (int c = 0; c < totalCols; c++) {
                sheet.autoSizeColumn(c);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void createHeaderCell(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private void requireOwnership(Assessment assessment) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!assessment.getClassroom().getTeacher().getId().equals(teacher.getId())) {
            throw new UnauthorizedActionException("You do not own this assessment");
        }
    }
}
