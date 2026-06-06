package com.edueval.dto.response;
import lombok.Data;
 
import java.util.List;
import java.util.UUID;

@Data
public class QuestionEvaluationResponse {
    private UUID questionSubmissionId;
    private Integer questionNo;
    private String questionText;
    private Integer maxMarks;
 
    // AI results
    private Double aiMarks;
    private Double aiConfidence;
    private Object aiFeedback;          // parsed from JSON
 
    // Teacher override (null until reviewed)
    private Double teacherMarks;
    private String teacherComment;
 
    // Effective marks = teacherMarks if set, else aiMarks
    private Double effectiveMarks;
 
    private String status;
    private String fileUrl;
}