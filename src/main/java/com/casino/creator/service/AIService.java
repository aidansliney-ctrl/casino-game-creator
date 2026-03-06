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

import java.util.List;

@Service
public class AIService {

    @Value("${gemini.api.key:}")
    private String apiKey;

    private static final String MODEL_NAME = "gemini-2.0-flash-exp";

    private static final String SYSTEM_PROMPT = """
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

    public String chat(String userMessage, List<String> conversationHistory, String apiKey, String provider) {
        try {
            // Build conversation context
            StringBuilder context = new StringBuilder(SYSTEM_PROMPT);
            context.append("\n\nConversation History:\n");

            if (conversationHistory != null && !conversationHistory.isEmpty()) {
                for (String msg : conversationHistory) {
                    context.append(msg).append("\n");
                }
            }
            context.append("\nUser: ").append(userMessage);
            String fullPrompt = context.toString();

            if ("claude".equalsIgnoreCase(provider)) {
                return chatWithClaude(fullPrompt, apiKey);
            } else {
                return chatWithGemini(fullPrompt, apiKey);
            }

        } catch (Exception e) {
            return "Error: Unable to connect to AI service. " + e.getMessage();
        }
    }

    private String chatWithGemini(String prompt, String clientApiKey) throws Exception {
        // Determine which API key to use
        String keyToUse = (clientApiKey != null && !clientApiKey.isEmpty()) ? clientApiKey : this.apiKey;

        // Instantiate the client with the API key
        Client client;
        if (keyToUse != null && !keyToUse.isEmpty()) {
            client = Client.builder()
                    .apiKey(keyToUse)
                    .build();
        } else {
            return "Error: Gemini API Key is missing. Please configure it in Settings.";
        }

        // Generate response
        GenerateContentResponse response = client.models.generateContent(
                MODEL_NAME,
                prompt,
                null);

        return response.text();
    }

    private String chatWithClaude(String prompt, String apiKey) {
        if (apiKey == null || apiKey.isEmpty()) {
            return "Error: Anthropic API Key is missing. Please configure it in Settings.";
        }

        try {
            AnthropicClient client = AnthropicOkHttpClient.builder()
                    .apiKey(apiKey)
                    .build();

            MessageCreateParams params = MessageCreateParams.builder()
                    .maxTokens(1024L)
                    .model(Model.CLAUDE_3_7_SONNET_LATEST)
                    .addUserMessage(prompt)
                    .build();

            Message response = client.messages().create(params);

            // Extract text from response
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
