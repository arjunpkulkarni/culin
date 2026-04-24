import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

interface BedrockChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface BedrockInvokeParams {
  modelId: string;
  messages: BedrockChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  region?: string;
}

export async function bedrockChat(params: BedrockInvokeParams): Promise<string> {
  const region = params.region || process.env.AWS_REGION || 'us-east-1';

  const client = new BedrockRuntimeClient({ region });

  const systemBlocks = params.messages
    .filter(m => m.role === 'system')
    .map(m => ({ text: m.content }));

  const conversation = params.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: [{ text: m.content }]
    }));

  const command = new ConverseCommand({
    modelId: params.modelId,
    messages: conversation,
    ...(systemBlocks.length > 0 ? { system: systemBlocks } : {}),
    inferenceConfig: {
      maxTokens: params.maxTokens ?? 512,
      temperature: params.temperature ?? 0.5,
      topP: params.topP ?? 0.9,
    },
  });

  const response = await client.send(command);
  const text = response?.output?.message?.content?.[0]?.text || '';
  return text;
}


