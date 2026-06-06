package com.edueval.dto.request;
import lombok.Data;
 
import java.util.List;
import java.util.UUID;
@Data
public class QuestionOverrideRequest {
    private Double teacherMarks;
    private String teacherComment;
}
