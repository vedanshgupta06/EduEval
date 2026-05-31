package com.edueval.service;

import com.edueval.entity.Submission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiEngineService {

    // Injected as a Spring bean — timeouts configured in AppConfig
    private final RestTemplate restTemplate;

    @Value("${app.ai-engine.base-url}")
    private String aiBaseUrl;

    @Async
    public void evaluate(Submission submission,
                         Consumer<String> onSuccess,
                         Consumer<Throwable> onError) {

        UUID submissionId = submission.getId();
        log.info("Sending submission {} to AI engine", submissionId);

        Map<String, Object> payload = Map.of(
                "submission_id",     submissionId.toString(),
                "file_url",          submission.getFileUrl(),
                "model_answer_url",  nullSafe(submission.getExam().getModelAnswerUrl()),
                "model_answer_text", nullSafe(submission.getExam().getModelAnswerText()),
                "total_marks",       submission.getExam().getTotalMarks()
        );

        try {
            String result = restTemplate.postForObject(
                    aiBaseUrl + "/evaluate",
                    payload,
                    String.class
            );
            log.info("AI evaluation complete for submission {}", submissionId);
            onSuccess.accept(result != null ? result : "{}");
        } catch (Exception e) {
            log.error("AI engine error for submission {}: {}", submissionId, e.getMessage());
            onError.accept(e);
        }
    }

    private String nullSafe(String val) {
        return val != null ? val : "";
    }
}
