export interface RetrievedMessage {
  messageId: string;
  senderName: string | null;
  sentAt: string | null;
  text: string;
}

export interface AnswerContext {
  chatId: string;
  question: string;
  messages: RetrievedMessage[];
}

export interface AIProvider {
  generateAnswer(context: AnswerContext): Promise<string>;
}

/**
 * Providers must only receive context retrieved for the active chat.
 * Implement API and local-model adapters separately; never pass cross-chat results.
 */
