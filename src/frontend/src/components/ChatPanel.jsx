import { useState, useRef, useEffect } from 'react';
import { compileScene } from '../engine/SceneCompiler';

const IMAGE_KEYWORDS = /\b(generate|create|make|draw|design)\b.*\b(image|icon|sticker|picture|art|asset|symbol|sprite|graphic)\b/i;

export function ChatPanel({ apiKey, provider, gameConfig, sceneSource, onSceneModified, onSceneUndo, canUndo, usedAssets, onAssetChange }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi! I\'m your casino game design assistant. I can modify your game in real-time — just tell me what to change!\n\nI can also generate images for your assets. Try "generate cat-themed sticker images"!' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleImageGeneration = async (userMessage) => {
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Generating images for ${(usedAssets || []).length} asset(s)... This may take a moment.`,
            type: 'modification'
        }]);

        try {
            const response = await fetch('/api/nano-banana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    assets: usedAssets || [],
                    history: messages.map(m => `${m.role}: ${m.content}`)
                })
            });

            const data = await response.json();

            if (data.generatedAssets) {
                const savedImages = JSON.parse(localStorage.getItem('qtm_generated_images') || '[]');
                for (const [assetId, imageUrl] of Object.entries(data.generatedAssets)) {
                    onAssetChange(assetId, imageUrl);
                    const asset = (usedAssets || []).find(a => String(a.id) === String(assetId));
                    const name = asset ? asset.name : assetId;
                    savedImages.push({
                        id: Date.now() + '_' + assetId,
                        name: name + ' (' + userMessage.slice(0, 30) + ')',
                        src: imageUrl,
                        timestamp: new Date().toISOString()
                    });
                }
                localStorage.setItem('qtm_generated_images', JSON.stringify(savedImages));
                window.dispatchEvent(new Event('storage'));
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message || `Generated ${Object.keys(data.generatedAssets).length} image(s)!`,
                    type: 'modification'
                }]);
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message || 'Could not generate images.',
                    type: 'error'
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Unable to connect to image generation service.',
                type: 'error'
            }]);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // Check if user is asking for image generation
            if (IMAGE_KEYWORDS.test(userMessage) && usedAssets && usedAssets.length > 0) {
                await handleImageGeneration(userMessage);
                return;
            }

            const history = messages.map(m => `${m.role}: ${m.content}`);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey || '',
                    'X-AI-Provider': provider || 'gemini'
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: history,
                    gameContext: gameConfig ? JSON.stringify(gameConfig) : null,
                    sceneSource: sceneSource || null
                })
            });

            const data = await response.json();

            // Check if AI returned a scene modification
            if (data.sceneSource) {
                // Validate by compiling first
                const compileResult = compileScene(data.sceneSource);

                if (compileResult.error) {
                    // Compilation failed — try auto-retry once
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: data.message || 'I attempted to make changes, but there was a compilation error. Retrying...',
                        type: 'error'
                    }]);

                    // Auto-retry: send the error back to the AI
                    const retryResponse = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKey || '',
                            'X-AI-Provider': provider || 'gemini'
                        },
                        body: JSON.stringify({
                            message: `Your previous code had this compilation error: ${compileResult.error}. Please fix it and return the complete corrected source code.`,
                            history: [...history, `user: ${userMessage}`, `assistant: ${data.message || 'Made changes'}`],
                            gameContext: gameConfig ? JSON.stringify(gameConfig) : null,
                            sceneSource: sceneSource || null
                        })
                    });

                    const retryData = await retryResponse.json();

                    if (retryData.sceneSource) {
                        const retryCompile = compileScene(retryData.sceneSource);
                        if (!retryCompile.error) {
                            // Retry succeeded
                            const applyResult = onSceneModified(retryData.sceneSource, userMessage);
                            if (applyResult?.error) {
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: `Failed to apply: ${applyResult.error}`,
                                    type: 'error'
                                }]);
                            } else {
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: retryData.message || data.message || 'Changes applied!',
                                    type: 'modification'
                                }]);
                            }
                        } else {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `Could not apply changes after retry: ${retryCompile.error}. The game is unchanged.`,
                                type: 'error'
                            }]);
                        }
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: retryData.response || retryData.message || 'Could not fix the code. The game is unchanged.',
                            type: 'error'
                        }]);
                    }
                } else {
                    // Compilation succeeded — apply it
                    const applyResult = onSceneModified(data.sceneSource, userMessage);
                    if (applyResult?.error) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Failed to apply: ${applyResult.error}`,
                            type: 'error'
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: data.message || 'Changes applied!',
                            type: 'modification'
                        }]);
                    }
                }
            } else {
                // Normal text response (no code change)
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response || data.message || 'Sorry, I encountered an error.'
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Unable to connect to AI service.',
                type: 'error'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-panel">
            {/* Messages */}
            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                        <div className="message-avatar">
                            {msg.role === 'user' ? '👤' : msg.type === 'modification' ? '✅' : msg.type === 'error' ? '⚠️' : '🤖'}
                        </div>
                        <div className="message-content">
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="chat-message assistant">
                        <div className="message-avatar">🤖</div>
                        <div className="message-content">
                            <span className="typing-indicator">●●●</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-wrapper">
                {canUndo && (
                    <button
                        onClick={onSceneUndo}
                        className="btn btn-sm"
                        style={{ marginRight: '0.5rem', fontSize: '0.75rem', background: 'var(--bg-input)' }}
                        title="Undo last AI change"
                    >
                        ↩ Undo
                    </button>
                )}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Tell me what to change..."
                    disabled={loading}
                    className="chat-input"
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="btn btn-sm"
                    style={{ marginLeft: '0.5rem' }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}
