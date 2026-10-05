package app.lector.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on {@code @Scheduled} jobs (the recommendation feature job); each job checks its own on/off property. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
