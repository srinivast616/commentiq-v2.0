import { env } from "../config/env";
import { AIProvider } from "./ai-provider.interface";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { MockProvider } from "./providers/mock.provider";

let instance: AIProvider | null = null;

// Single factory function — every module that needs AI calls imports
// `getAIProvider()` rather than constructing a provider itself, so the
// AI_PROVIDER env var is the one and only switch that changes behavior.
export function getAIProvider(): AIProvider {
  if (instance) return instance;
  instance = env.aiProvider === "anthropic" ? new AnthropicProvider() : new MockProvider();
  return instance;
}
