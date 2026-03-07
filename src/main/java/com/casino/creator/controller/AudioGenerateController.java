package com.casino.creator.controller;

import com.casino.creator.service.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/audio-generate")
public class AudioGenerateController {

    @Autowired
    private AIService aiService;

    @PostMapping
    public Map<String, Object> generate(@RequestBody AudioGenerateRequest request) {
        Map<String, Object> result = new HashMap<>();

        try {
            String prompt = request.getPrompt();
            if (prompt == null || prompt.trim().isEmpty()) {
                result.put("message", "Please provide a description of the sound effect.");
                return result;
            }

            Double duration = request.getDuration();
            String audioDataUrl = aiService.generateSoundEffect(prompt.trim(), duration);

            result.put("audioDataUrl", audioDataUrl);
            result.put("message", "Audio generated!");
            return result;

        } catch (Exception e) {
            result.put("message", "Error: " + e.getMessage());
            return result;
        }
    }

    public static class AudioGenerateRequest {
        private String prompt;
        private Double duration;

        public String getPrompt() { return prompt; }
        public void setPrompt(String prompt) { this.prompt = prompt; }

        public Double getDuration() { return duration; }
        public void setDuration(Double duration) { this.duration = duration; }
    }
}
