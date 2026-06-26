package com.example.diagram.web;

import com.example.diagram.service.LifecycleService;
import com.example.diagram.web.dto.LifecycleInfo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lifecycle risk + alternatives lookup (SiliconExpert-style, mock-backed). */
@RestController
@RequestMapping("/api/lifecycle")
public class LifecycleController {

    private final LifecycleService lifecycle;

    public LifecycleController(LifecycleService lifecycle) {
        this.lifecycle = lifecycle;
    }

    @GetMapping
    public LifecycleInfo lookup(@RequestParam("part") String partNumber) {
        return lifecycle.lookup(partNumber);
    }
}
