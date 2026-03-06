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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AIService {

    @Value("${gemini.api.key:}")
    private String apiKey;

    private static final String MODEL_NAME = "gemini-2.5-flash";
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
