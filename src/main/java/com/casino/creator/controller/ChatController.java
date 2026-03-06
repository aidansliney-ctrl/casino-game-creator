package com.casino.creator.controller;

import com.casino.creator.service.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    @Autowired
    private AIService aiService;

    @PostMapping
    public Map<String, String> chat(
            @RequestBody ChatRequest request,
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @RequestHeader(value = "X-AI-Provider", required = false, defaultValue = "gemini") String provider) {
        String response = aiService.chat(request.getMessage(), request.getHistory(), apiKey, provider);
        return Map.of("response", response);
    }

    // DTO for request
    public static class ChatRequest {
        private String message;
        private List<String> history;

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public List<String> getHistory() {
            return history;
        }

        public void setHistory(List<String> history) {
            this.history = history;
        }
    }
}
