import { useState, useRef, useEffect } from 'react';
import { compileScene } from '../engine/SceneCompiler';

export function ChatPanel({ apiKey, provider, gameConfig, sceneSource, onSceneModified, onSceneUndo, canUndo }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi! I\'m your casino game design assistant. I can modify your game in real-time — just tell me what to change!' }
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

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
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
