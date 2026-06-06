package com.edueval.dto.response;
import lombok.Data;
 
import java.util.List;
import java.util.UUID;
@Data
public class QuestionResponse {
    private UUID id;
    private Integer questionNo;
    private String questionText;
    private Integer marks;
    
}