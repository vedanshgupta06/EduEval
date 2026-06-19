package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class ExamResponse {

    private UUID id;
    private String title;
    private String questionText;
    private Integer totalMarks;
    private LocalDateTime deadline;
    private String modelAnswerUrl;
    private String modelAnswerText;
    private UUID classroomId;
    private String classroomName;
    private String teacherName;
    private long submissionCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Boolean isMultiQuestion;
    private List<QuestionResponse> questions;   // null for single-answer exams

    // ── Constructor used by ExamService.toResponse() ──────────────────────────
    public ExamResponse(UUID id, String title, String questionText, Integer totalMarks, LocalDateTime deadline,
                        String modelAnswerUrl, String modelAnswerText,
                        UUID classroomId, String classroomName, String teacherName,
                        long submissionCount, LocalDateTime createdAt,
                        LocalDateTime updatedAt, Boolean isMultiQuestion) {
        this.id = id;
        this.title = title;
        this.questionText = questionText;
        this.totalMarks = totalMarks;
        this.deadline = deadline;
        this.modelAnswerUrl = modelAnswerUrl;
        this.modelAnswerText = modelAnswerText;
        this.classroomId = classroomId;
        this.classroomName = classroomName;
        this.teacherName = teacherName;
        this.submissionCount = submissionCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.isMultiQuestion = isMultiQuestion;
        this.questions = null;
    }

    public ExamResponse() {}

    // ── Getters ───────────────────────────────────────────────────────────────
    public UUID getId()                    { return id; }
    public String getTitle()               { return title; }
    public String getQuestionText()        { return questionText; }
    public Integer getTotalMarks()         { return totalMarks; }
    public LocalDateTime getDeadline()     { return deadline; }
    public String getModelAnswerUrl()      { return modelAnswerUrl; }
    public String getModelAnswerText()     { return modelAnswerText; }
    public UUID getClassroomId()           { return classroomId; }
    public String getClassroomName()       { return classroomName; }
    public String getTeacherName()         { return teacherName; }
    public long getSubmissionCount()       { return submissionCount; }
    public LocalDateTime getCreatedAt()    { return createdAt; }
    public LocalDateTime getUpdatedAt()    { return updatedAt; }
    public Boolean getIsMultiQuestion()    { return isMultiQuestion; }
    public List<QuestionResponse> getQuestions() { return questions; }

    // ── Setters (needed by ExamService.getExamById to attach questions) ───────
    public void setQuestions(List<QuestionResponse> questions) { this.questions = questions; }
    public void setIsMultiQuestion(Boolean isMultiQuestion)    { this.isMultiQuestion = isMultiQuestion; }
    public void setQuestionText(String questionText)           { this.questionText = questionText; }
}
