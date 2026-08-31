export interface ModelOpt {
  id: string;
  label: string;
}

export const MODELS: Record<string, ModelOpt[]> = {
  ollama: [
    { id: "glm-5.3", label: "GLM-5.3" },
    { id: "glm-5.3-flash", label: "GLM-5.3 Flash" },
    { id: "kimi-k3", label: "Kimi K3" },
    { id: "gemma4", label: "Gemma 4" },
    { id: "qwen3.5", label: "Qwen 3.5" },
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    { id: "minimax-m3", label: "MiniMax M3" },
    { id: "gpt-oss", label: "gpt-oss" },
    { id: "nemotron-3-ultra", label: "Nemotron 3 Ultra" },
    { id: "mistral-large-3", label: "Mistral Large 3" },
  ],
  openai: [
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { id: "gpt-5.6", label: "GPT-5.6" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "o3", label: "o3" },
  ],
  anthropic: [
    { id: "claude-fable-5", label: "Claude Fable 5" },
    { id: "claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  ],
  openrouter: [
    { id: "openai/gpt-5.6", label: "GPT-5.6" },
    { id: "anthropic/claude-opus-5", label: "Claude Opus 5" },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "qwen/qwen3.5", label: "Qwen 3.5" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek" },
    { id: "x-ai/grok-4", label: "Grok 4" },
    { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
  ],
};

export const PROVIDER_LABEL: Record<string, string> = {
  ollama: "Ollama Cloud",
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
};
