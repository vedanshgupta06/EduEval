package com.edueval.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class DatabaseSchemaFixer {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner relaxSubmissionFileUrlConstraint() {
        return args -> {
            try {
                jdbcTemplate.execute("ALTER TABLE submissions ALTER COLUMN file_url DROP NOT NULL");
                log.info("Ensured submissions.file_url allows empty multi-question drafts.");
            } catch (Exception ex) {
                log.debug("Skipping submissions.file_url constraint update: {}", ex.getMessage());
            }
        };
    }
}
