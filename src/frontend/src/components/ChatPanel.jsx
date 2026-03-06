import { useState, useRef, useEffect } from 'react';

export function ChatPanel({ apiKey, provider }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi! I\'m your casino game design assistant. Describe the game you\'d like to create!' }
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

        // Add user message
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // Build conversation history
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
                    history: history
                })
            });

            const data = await response.json();

            // Add AI response
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.response || 'Sorry, I encountered an error.'
            }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Unable to connect to AI service.'
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
                            {msg.role === 'user' ? '👤' : '🤖'}
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
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Describe your game idea..."
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
