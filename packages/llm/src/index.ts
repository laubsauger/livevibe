export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LLMProvider {
    chat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<void>;
}

export class MockLLMProvider implements LLMProvider {
    async chat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<void> {
        const lastMessage = messages[messages.length - 1];
        // const response = `I am a mock assistant. I received your message: "${lastMessage.content}". 
        const response = ` 
        
Here is a Strudel snippet:
\`\`\`javascript
samples('github:yaxu/clean-breaks')
s("amen/4").fit().chop(16).cut(1)
.sometimesBy(.5, ply("2"))
.sometimesBy(.25, mul(speed("-1")))
\`\`\`
`;

        // Simulate streaming
        const chunks = response.split('');
        for (const chunk of chunks) {
            await new Promise(r => setTimeout(r, 20));
            onDelta(chunk);
        }
    }
}
