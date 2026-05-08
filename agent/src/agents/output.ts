export interface AgentInvocation {
  structuredResponse?: unknown;
  messages?: unknown[];
}

interface MessageLike {
  content?: unknown;
}

export const toAgentInvocation = (value: unknown): AgentInvocation => {
  if (!value || typeof value !== "object") return {};
  const objectValue = value as Record<string, unknown>;
  return {
    structuredResponse: objectValue.structuredResponse,
    messages: Array.isArray(objectValue.messages) ? objectValue.messages : undefined,
  };
};

export const extractFinalMessageText = (invocation: AgentInvocation): string => {
  const messages = invocation.messages ?? [];
  const finalMessage = messages[messages.length - 1] as MessageLike | undefined;
  return stringifyMessageContent(finalMessage?.content);
};

export const extractJsonObject = (text: string): string | null => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  return start === -1 ? null : firstBalancedObject(trimmed, start) ?? malformedObjectCandidate(trimmed, start);
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

const firstBalancedObject = (text: string, start: number): string | null => {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return null;
};

const malformedObjectCandidate = (text: string, start: number): string | null => {
  const end = text.indexOf("}", start + 1);
  return end > start ? text.slice(start, end + 1) : null;
};
