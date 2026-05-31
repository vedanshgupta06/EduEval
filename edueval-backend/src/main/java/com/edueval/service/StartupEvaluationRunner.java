package com.edueval.service;

import com.edueval.entity.Evaluation;
import com.edueval.enums.SubmissionStatus;
import com.edueval.repository.EvaluationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class StartupEvaluationRunner implements ApplicationRunner {

    private final EvaluationRepository evaluationRepository;
    private final EvaluationService evaluationService;

    @Override
    public void run(ApplicationArguments args) {
        List<Evaluation> pending = evaluationRepository.findPendingEvaluations();

        if (pending.isEmpty()) {
            log.info("No pending evaluations found on startup.");
            return;
        }

        log.info("Found {} pending evaluation(s) on startup — triggering re-evaluation...", pending.size());

        for (Evaluation evaluation : pending) {
            try {
                evaluationService.triggerReEvaluationInternal(evaluation);
                log.info("Re-triggered evaluation {}", evaluation.getId());
            } catch (Exception e) {
                log.error("Failed to re-trigger evaluation {}: {}", evaluation.getId(), e.getMessage());
            }
        }
    }
}