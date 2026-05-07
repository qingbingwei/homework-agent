import type { ChatOpenAI } from "@langchain/openai";
import type { CreateDeepAgentParams } from "deepagents";

export type DeepAgentModel = CreateDeepAgentParams["model"];

interface MessageLike {
  content?: unknown;
}

interface InvocationLike {
  messages?: unknown[];
}

export const asDeepAgentModel = (llm: ChatOpenAI): DeepAgentModel => (
  llm as unknown as DeepAgentModel
);

export const extractFinalMessageText = (invocation: unknown): string => {
  const messages = (invocation as InvocationLike).messages ?? [];
  const finalMessage = messages[messages.length - 1] as MessageLike | undefined;
  return stringifyMessageContent(finalMessage?.content);
};

export const extractJsonObject = (text: string): string | null => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const object = trimmed.match(/\{[\s\S]*\}\s*$/);
  return object ? object[0] : null;
};

const stringifyMessageContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return stringifyContentParts(content);
  if (content == null) return "";
  return JSON.stringify(content);
};

const stringifyContentParts = (parts: unknown[]): string => (
  parts.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part) {
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : JSON.stringify(text);
    }
    return JSON.stringify(part);
  }).join("")
);
