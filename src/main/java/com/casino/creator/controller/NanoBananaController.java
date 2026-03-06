package com.casino.creator.controller;

import com.casino.creator.service.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/nano-banana")
public class NanoBananaController {

    @Autowired
    private AIService aiService;

    @PostMapping
    public Map<String, Object> generate(@RequestBody NanoBananaRequest request) {

        try {
            List<Map<String, Object>> assets = request.getAssets();
            if (assets == null || assets.isEmpty()) {
                Map<String, Object> result = new HashMap<>();
                result.put("message", "No assets to generate images for. Load a game first!");
                return result;
            }

            String userStyle = request.getMessage();
            List<String> styleHints = request.getStyleHints();
            Map<String, String> generatedAssets = new LinkedHashMap<>();
            StringBuilder statusMessages = new StringBuilder();
            int successCount = 0;

            String referenceImage = request.getReferenceImage();

            for (Map<String, Object> asset : assets) {
                String assetId = String.valueOf(asset.getOrDefault("id", ""));

                StringBuilder promptBuilder = new StringBuilder();
                promptBuilder.append(userStyle).append(". ");

                if (styleHints != null && !styleHints.isEmpty()) {
                    // Filter out the "match" hint — that's handled by the reference image
                    List<String> textHints = styleHints.stream()
                            .filter(h -> !h.contains("reference image"))
                            .collect(Collectors.toList());
                    if (!textHints.isEmpty()) {
                        promptBuilder.append(String.join(". ", textHints)).append(". ");
                    }
                }

                if (referenceImage != null && !referenceImage.isEmpty()) {
                    promptBuilder.append("Match the visual style of the reference image but not the colors. ");
                }

                promptBuilder.append("Centered on a plain white background, no scenery or patterns.");

                String imagePrompt = promptBuilder.toString();

                try {
                    String dataUrl = aiService.generateImage(imagePrompt, referenceImage);
                    if (dataUrl != null) {
                        generatedAssets.put(assetId, dataUrl);
                        successCount++;
                    } else {
                        statusMessages.append("Could not generate image for ").append(assetId).append(". ");
                    }
                } catch (Exception e) {
                    statusMessages.append("Failed on ").append(assetId).append(": ").append(e.getMessage()).append(". ");
                }
            }

            Map<String, Object> result = new HashMap<>();
            if (successCount > 0) {
                result.put("generatedAssets", generatedAssets);
                result.put("message", "Generated " + successCount + " of " + assets.size() + " image(s)! " + statusMessages);
            } else {
                result.put("message", "Could not generate any images. " + statusMessages);
            }
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("message", "Error: " + e.getMessage());
            return result;
        }
    }

    public static class NanoBananaRequest {
        private String message;
        private List<Map<String, Object>> assets;
        private List<String> history;

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public List<Map<String, Object>> getAssets() { return assets; }
        public void setAssets(List<Map<String, Object>> assets) { this.assets = assets; }

        public List<String> getHistory() { return history; }
        public void setHistory(List<String> history) { this.history = history; }

        public List<String> getStyleHints() { return styleHints; }
        public void setStyleHints(List<String> styleHints) { this.styleHints = styleHints; }
        private List<String> styleHints;

        public String getReferenceImage() { return referenceImage; }
        public void setReferenceImage(String referenceImage) { this.referenceImage = referenceImage; }
        private String referenceImage;
    }
}
