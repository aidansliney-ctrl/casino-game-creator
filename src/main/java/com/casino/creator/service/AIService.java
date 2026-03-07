package com.casino.creator.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.anthropic.models.messages.ContentBlock;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.Part;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AIService {

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${elevenlabs.api.key:}")
    private String elevenLabsApiKey;

    private static final String MODEL_NAME = "gemini-3.1-pro-preview";
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private static final String CODE_MODIFICATION_PROMPT = """
            You are a casino game scene code modifier. You receive the full source code of a running HTML5 canvas game scene, plus a user request to change it.

            RULES:
            1. Return the COMPLETE modified source code. Do not omit any methods or truncate with comments like "// rest of code...".
            2. The scene class MUST implement: constructor(config), enter(game), exit(), update(dt), render(ctx).
            3. Optional methods you should keep if present: setAudioManager(am), getUsedAssets().
            4. The class name MUST end in "Scene" (e.g., ThreeReelSlotScene, MyCustomScene).
            5. Do NOT use import or require statements. The code must be self-contained.
            6. Do NOT use export keywords.
            7. You have access to: Canvas 2D API (ctx), the game object (this.game with .renderer.width/.height, .input), this.audioManager, and this.config.
            8. Keep ALL existing functionality unless the user explicitly asks to remove it.
            9. For complex changes, implement them fully — do not leave TODO placeholders.
            10. Maintain the same code style and patterns as the original.

            RESPONSE FORMAT — you MUST respond in this exact JSON format, with no other text before or after:
            {
              "message": "Brief description of what you changed",
              "sceneSource": "class ThreeReelSlotScene { ... full source code ... }"
            }

            If the user is asking a question (not requesting a code change), respond with:
            {
              "message": "Your answer here",
              "sceneSource": null
            }

            IMPORTANT: Your response must be valid JSON. Escape special characters in strings properly.
            """;

    private static final String CHAT_ONLY_PROMPT = """
            You are an expert casino game designer assistant. Your role is to help users create HTML5 canvas casino games.

            When users describe game ideas, you should:
            1. Suggest appropriate game types (slots, table games, instant win, etc.)
            2. Recommend math models with RTP ranges
            3. Propose visual themes and asset combinations
            4. Guide them on bonus features and mechanics
            5. Provide specific, actionable suggestions

            Keep responses concise and focused on practical game design decisions.
            Always consider mobile-first design and regulatory compliance.
            """;

    public Map<String, String> chat(String userMessage, List<String> conversationHistory,
                                     String apiKey, String provider, String gameContext,
                                     String sceneSource) {
        try {
            boolean hasSceneSource = sceneSource != null && !sceneSource.isEmpty();
            String systemPrompt = hasSceneSource ? CODE_MODIFICATION_PROMPT : CHAT_ONLY_PROMPT;

            StringBuilder context = new StringBuilder(systemPrompt);

            // Include scene source code for modification mode
            if (hasSceneSource) {
                context.append("\n\nCURRENT SCENE SOURCE CODE:\n```javascript\n");
                context.append(sceneSource);
                context.append("\n```\n");
            }

            // Include game config
            if (gameContext != null && !gameContext.isEmpty()) {
                context.append("\n\nCURRENT GAME CONFIGURATION:\n");
                context.append(gameContext);
            }

            context.append("\n\nConversation History:\n");
            if (conversationHistory != null && !conversationHistory.isEmpty()) {
                for (String msg : conversationHistory) {
                    context.append(msg).append("\n");
                }
            }
            context.append("\nUser: ").append(userMessage);
            String fullPrompt = context.toString();

            String rawResponse;
            if ("claude".equalsIgnoreCase(provider)) {
                rawResponse = chatWithClaude(fullPrompt, apiKey, hasSceneSource);
            } else {
                rawResponse = chatWithGemini(fullPrompt, apiKey, hasSceneSource);
            }

            // If we're in code modification mode, try to parse as JSON
            if (hasSceneSource) {
                return parseStructuredResponse(rawResponse);
            }

            // Plain text mode
            Map<String, String> result = new HashMap<>();
            result.put("response", rawResponse);
            return result;

        } catch (Exception e) {
            Map<String, String> result = new HashMap<>();
            result.put("response", "Error: Unable to connect to AI service. " + e.getMessage());
            return result;
        }
    }

    private Map<String, String> parseStructuredResponse(String rawResponse) {
        Map<String, String> result = new HashMap<>();

        try {
            // Clean up response - strip markdown code fences if present
            String cleaned = rawResponse.trim();
            if (cleaned.startsWith("```json")) {
                cleaned = cleaned.substring(7);
            } else if (cleaned.startsWith("```")) {
                cleaned = cleaned.substring(3);
            }
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3);
            }
            cleaned = cleaned.trim();

            JsonNode json = objectMapper.readTree(cleaned);

            String message = json.has("message") ? json.get("message").asText() : "Changes applied.";
            result.put("message", message);

            if (json.has("sceneSource") && !json.get("sceneSource").isNull()) {
                result.put("sceneSource", json.get("sceneSource").asText());
            }

            return result;
        } catch (Exception e) {
            // JSON parsing failed — treat as plain text response
            result.put("response", rawResponse);
            return result;
        }
    }

    /**
     * Public entry point for calling the AI provider with a raw prompt.
     */
    public String callProvider(String prompt, String clientApiKey, String provider) throws Exception {
        if ("claude".equalsIgnoreCase(provider)) {
            return chatWithClaude(prompt, clientApiKey, false);
        } else {
            return chatWithGemini(prompt, clientApiKey, false);
        }
    }

    /**
     * Generate a sticker-style image using Gemini, then remove the background with rembg.
     * Returns a base64-encoded data URL (data:image/png;base64,...) or null on failure.
     */
    public String generateImage(String prompt, String referenceImageDataUrl) throws Exception {
        String keyToUse = (this.apiKey != null && !this.apiKey.isEmpty()) ? this.apiKey : null;
        if (keyToUse == null) {
            throw new Exception("Gemini API Key is missing.");
        }

        Client client = Client.builder().apiKey(keyToUse).build();

        GenerateContentConfig config = GenerateContentConfig.builder()
                .responseModalities("IMAGE", "TEXT")
                .build();

        GenerateContentResponse response;

        if (referenceImageDataUrl != null && !referenceImageDataUrl.isEmpty()
                && referenceImageDataUrl.startsWith("data:")) {
            // Multimodal: send text + reference image
            String mimeType = "image/png";
            String base64Data = referenceImageDataUrl;
            int commaIdx = referenceImageDataUrl.indexOf(',');
            if (commaIdx > 0) {
                String prefix = referenceImageDataUrl.substring(0, commaIdx);
                if (prefix.contains("/")) {
                    mimeType = prefix.replaceAll("^data:", "").replaceAll(";base64$", "");
                }
                base64Data = referenceImageDataUrl.substring(commaIdx + 1);
            }
            byte[] imageBytes = Base64.getDecoder().decode(base64Data);

            List<Part> parts = List.of(
                    Part.builder().text(prompt).build(),
                    Part.builder().inlineData(
                            com.google.genai.types.Blob.builder()
                                    .mimeType(mimeType)
                                    .data(imageBytes)
                                    .build()
                    ).build()
            );

            com.google.genai.types.Content content = com.google.genai.types.Content.builder()
                    .role("user")
                    .parts(parts)
                    .build();

            response = client.models.generateContent(
                    "nano-banana-pro-preview",
                    content,
                    config);
        } else {
            // Text-only prompt
            response = client.models.generateContent(
                    "nano-banana-pro-preview",
                    prompt,
                    config);
        }

        // Extract image part from response
        String rawBase64 = null;
        for (Part part : response.parts()) {
            if (part.inlineData().isPresent()) {
                var blob = part.inlineData().get();
                if (blob.data().isPresent() && blob.mimeType().isPresent()) {
                    byte[] data = blob.data().get();
                    rawBase64 = Base64.getEncoder().encodeToString(data);
                    break;
                }
            }
        }

        if (rawBase64 == null) {
            return null;
        }

        // Remove background using rembg Python script
        String transparentBase64 = removeBackground(rawBase64);
        return "data:image/png;base64," + transparentBase64;
    }

    /**
     * Generate a sound effect using ElevenLabs Sound Generation API.
     * Returns a base64-encoded data URL (data:audio/mpeg;base64,...) or throws on failure.
     */
    public String generateSoundEffect(String prompt, Double durationSeconds) throws Exception {
        if (elevenLabsApiKey == null || elevenLabsApiKey.isEmpty()) {
            throw new Exception("ElevenLabs API Key is missing. Set the ELEVENLABS_API_KEY environment variable.");
        }

        var httpClient = java.net.http.HttpClient.newHttpClient();

        // Build JSON body
        StringBuilder jsonBody = new StringBuilder();
        jsonBody.append("{\"text\":\"").append(prompt.replace("\"", "\\\"")).append("\"");
        if (durationSeconds != null && durationSeconds > 0) {
            jsonBody.append(",\"duration_seconds\":").append(durationSeconds);
        }
        jsonBody.append("}");

        var request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create("https://api.elevenlabs.io/v1/sound-generation"))
                .header("xi-api-key", elevenLabsApiKey)
                .header("Content-Type", "application/json")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBody.toString()))
                .build();

        var response = httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() != 200) {
            String errorBody = new String(response.body(), java.nio.charset.StandardCharsets.UTF_8);
            throw new Exception("ElevenLabs API error (HTTP " + response.statusCode() + "): " + errorBody);
        }

        byte[] audioBytes = response.body();
        String base64Audio = Base64.getEncoder().encodeToString(audioBytes);
        return "data:audio/mpeg;base64," + base64Audio;
    }

    /**
     * Calls the rembg Python script to remove background and add sticker outline.
     */
    private String removeBackground(String base64Png) throws Exception {
        // Find the script relative to the working directory
        String scriptPath = System.getProperty("user.dir") + "/scripts/remove_bg.py";

        ProcessBuilder pb = new ProcessBuilder("python3", scriptPath);
        pb.redirectErrorStream(false);
        Process process = pb.start();

        // Write base64 to stdin
        try (var os = process.getOutputStream()) {
            os.write(base64Png.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.flush();
        }

        // Read result from stdout
        String result;
        try (var is = process.getInputStream()) {
            result = new String(is.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).trim();
        }

        // Read any errors
        String errors;
        try (var es = process.getErrorStream()) {
            errors = new String(es.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).trim();
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new Exception("rembg failed (exit " + exitCode + "): " + errors);
        }

        return result;
    }

    private String chatWithGemini(String prompt, String clientApiKey, boolean highTokenMode) throws Exception {
        String keyToUse = (clientApiKey != null && !clientApiKey.isEmpty()) ? clientApiKey : this.apiKey;

        Client client;
        if (keyToUse != null && !keyToUse.isEmpty()) {
            client = Client.builder()
                    .apiKey(keyToUse)
                    .build();
        } else {
            return "Error: Gemini API Key is missing. Please configure it in Settings.";
        }

        GenerateContentResponse response = client.models.generateContent(
                MODEL_NAME,
                prompt,
                null);

        return response.text();
    }

    private String chatWithClaude(String prompt, String apiKey, boolean highTokenMode) {
        if (apiKey == null || apiKey.isEmpty()) {
            return "Error: Anthropic API Key is missing. Please configure it in Settings.";
        }

        try {
            AnthropicClient client = AnthropicOkHttpClient.builder()
                    .apiKey(apiKey)
                    .build();

            long maxTokens = highTokenMode ? 16384L : 1024L;

            MessageCreateParams params = MessageCreateParams.builder()
                    .maxTokens(maxTokens)
                    .model(Model.CLAUDE_3_7_SONNET_LATEST)
                    .addUserMessage(prompt)
                    .build();

            Message response = client.messages().create(params);

            if (response.content() != null && !response.content().isEmpty()) {
                ContentBlock first = response.content().get(0);
                if (first.isText()) {
                    return first.asText().text();
                }
            }

            return "Error: No text response from Claude.";

        } catch (Exception e) {
            return "Error connecting to Claude: " + e.getMessage();
        }
    }
}
