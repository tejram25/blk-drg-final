package com.example.diagram.service.impl;

import com.example.diagram.domain.UsageEvent;
import com.example.diagram.repository.UsageEventRepository;
import com.example.diagram.service.AuditService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AuditServiceImpl implements AuditService {

    private final UsageEventRepository repository;

    public AuditServiceImpl(UsageEventRepository repository) {
        this.repository = repository;
    }

    @Override
    public void record(String action, String userEmail, Long diagramId, String classification) {
        repository.save(new UsageEvent(action, userEmail, region(userEmail), classification, diagramId));
    }

    @Override
    public List<UsageEvent> recent() {
        return repository.findTop100ByOrderByOccurredAtDesc();
    }

    @Override
    public Map<String, Long> countsByAction() {
        return countBy(UsageEvent::getAction);
    }

    @Override
    public Map<String, Long> countsByRegion() {
        return countBy(e -> e.getRegion() == null ? "Unknown" : e.getRegion());
    }

    private Map<String, Long> countBy(Function<UsageEvent, String> key) {
        return repository.findAll().stream()
                .collect(Collectors.groupingBy(key, Collectors.counting()));
    }

    /**
     * Derive a coarse region bucket from the email domain. A real deployment
     * would resolve this from IdP claims or request geo-IP; for the POC the
     * domain TLD is a reasonable, dependency-free proxy.
     */
    private String region(String email) {
        if (email == null || !email.contains("@")) return "Unknown";
        String domain = email.substring(email.indexOf('@') + 1).toLowerCase();
        if (domain.endsWith(".uk") || domain.endsWith(".de") || domain.endsWith(".fr")
                || domain.endsWith(".eu")) return "EMEA";
        if (domain.endsWith(".cn") || domain.endsWith(".jp") || domain.endsWith(".in")
                || domain.endsWith(".sg") || domain.endsWith(".au")) return "APAC";
        return "Americas";
    }
}
