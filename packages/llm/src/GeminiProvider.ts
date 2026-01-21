import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, ChatMessage, ChatResult } from './index.js';
import { SystemPromptHarness, PromptContext } from './SystemPrompts.js';

export class GeminiProvider implements LLMProvider {
    private genAI: GoogleGenerativeAI;
    private modelName: string;

    constructor(apiKey: string, modelName: string = 'gemini-3-flash-preview') {
        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = modelName;
    }

    async chat(messages: ChatMessage[], onDelta: (delta: string) => void, context?: PromptContext): Promise<ChatResult> {
        try {
            const effectiveModel = context?.model || this.modelName;
            const model = this.genAI.getGenerativeModel({ model: effectiveModel });

            // Use the Harness to construct the prompt
            const { systemInstruction, history, lastUserMessage } = SystemPromptHarness.build(messages, context);

            const chatSession = model.startChat({
                history: history.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                })),
                systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
            });

            const result = await chatSession.sendMessageStream(lastUserMessage);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    onDelta(chunkText);
                }
            }

            const response = await result.response;
            const usage = response.usageMetadata;

            return {
                usage: usage ? {
                    inputTokens: usage.promptTokenCount,
                    outputTokens: usage.candidatesTokenCount,
                    totalTokens: usage.totalTokenCount,
                    costEstimate: 0 // TODO: Add pricing logic
                } : undefined
            };

        } catch (error) {
            console.error('Gemini Chat Error:', error);
            onDelta(`\n\n*Error: Failed to connect to Gemini (${error instanceof Error ? error.message : String(error)})*`);
            return {};
        }
    }
}
