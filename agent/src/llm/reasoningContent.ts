import { AsyncLocalStorage } from "node:async_hooks";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { ChatOpenAICompletions } from "@langchain/openai";
import type { OpenAI } from "openai";

type CompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type AssistantMessageParam = OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam & {
  reasoning_content?: string;
};
type MessagePatchResult = {
  readonly messages: CompletionMessageParam[];
  readonly changed: boolean;
};

const reasoningContentOf = (message: BaseMessage): string | undefined => {
  if (!AIMessage.isInstance(message)) return undefined;
  const value = message.additional_kwargs.reasoning_content;
  return typeof value === "string" ? value : undefined;
};

const isAssistantParam = (message: CompletionMessageParam): message is AssistantMessageParam => (
  message.role === "assistant"
);

const hasReasoningContent = (message: AssistantMessageParam): boolean => (
  typeof message.reasoning_content === "string"
);

const isAudioContinuation = (message: AssistantMessageParam): boolean => (
  "audio" in message && !("content" in message) && !("tool_calls" in message) && !("function_call" in message)
);

const findNextAiMessage = (
  messages: readonly BaseMessage[],
  startIndex: number,
): { readonly message: BaseMessage; readonly nextIndex: number } | undefined => {
  for (let index = startIndex; index < messages.length; index += 1) {
    const message = messages[index];
    if (message && AIMessage.isInstance(message)) {
      return { message, nextIndex: index + 1 };
    }
  }
  return undefined;
};

const patchCompletionMessages = (
  sourceMessages: readonly BaseMessage[],
  completionMessages: readonly CompletionMessageParam[],
): MessagePatchResult => {
  let changed = false;
  let sourceIndex = 0;
  const messages = completionMessages.map((message) => {
    if (!isAssistantParam(message) || isAudioContinuation(message)) return message;
    const matched = findNextAiMessage(sourceMessages, sourceIndex);
    if (!matched) return message;
    sourceIndex = matched.nextIndex;
    const reasoningContent = reasoningContentOf(matched.message);
    if (reasoningContent === undefined || hasReasoningContent(message)) return message;
    changed = true;
    return { ...message, reasoning_content: reasoningContent };
  });
  return { messages, changed };
};

export const copyReasoningContentToCompletionMessages = (
  sourceMessages: readonly BaseMessage[],
  completionMessages: readonly CompletionMessageParam[],
): CompletionMessageParam[] => patchCompletionMessages(sourceMessages, completionMessages).messages;

const patchCompletionRequest = <
  T extends OpenAI.Chat.ChatCompletionCreateParamsStreaming | OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
>(
  sourceMessages: readonly BaseMessage[],
  request: T,
): T => {
  const patched = patchCompletionMessages(sourceMessages, request.messages);
  if (!patched.changed) return request;
  return { ...request, messages: patched.messages } as T;
};

export class ReasoningContentChatOpenAICompletions extends ChatOpenAICompletions {
  private readonly sourceMessages = new AsyncLocalStorage<readonly BaseMessage[]>();

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    return this.sourceMessages.run(messages, () => super._generate(messages, options, runManager));
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const iterator = super._streamResponseChunks(messages, options, runManager);
    while (true) {
      const next = await this.sourceMessages.run(messages, () => iterator.next());
      if (next.done) return;
      yield next.value;
    }
  }

  override completionWithRetry(
    request: OpenAI.Chat.ChatCompletionCreateParamsStreaming,
    requestOptions?: OpenAI.RequestOptions,
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>>;
  override completionWithRetry(
    request: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    requestOptions?: OpenAI.RequestOptions,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion>;
  override completionWithRetry(
    request: OpenAI.Chat.ChatCompletionCreateParamsStreaming | OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    requestOptions?: OpenAI.RequestOptions,
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | OpenAI.Chat.Completions.ChatCompletion> {
    const sourceMessages = this.sourceMessages.getStore();
    const patchedRequest = sourceMessages ? patchCompletionRequest(sourceMessages, request) : request;
    return super.completionWithRetry(patchedRequest as never, requestOptions);
  }
}
