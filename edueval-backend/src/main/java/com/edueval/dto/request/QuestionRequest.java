package com.edueval.dto.request;
import lombok.Data;
 
import java.util.List;
import java.util.UUID;
@Data
public class QuestionRequest {
    private String questionText;
    private Integer marks;
    private String modelAnswerText;
}