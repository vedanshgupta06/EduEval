package com.edueval.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);       // always-alive threads
        executor.setMaxPoolSize(10);       // max threads under load
        executor.setQueueCapacity(50);     // queue before rejecting
        executor.setThreadNamePrefix("ai-eval-");
        executor.initialize();
        return executor;
    }
}
