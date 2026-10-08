'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

export interface ExamAssistantContext {
  title: string;
  subject: string;
  classLevel: string;
  rubric?: string;
  currentQuestionText?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExamAssistantChatProps {
  examContext: ExamAssistantContext;
  activeQuestionIndex: number | null;
  activeQuestionText: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function ExamAssistantChat({
  examContext,
  activeQuestionIndex,
  activeQuestionText,
  isOpen,
  onOpenChange,
}: ExamAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeQuestionIndex, activeQuestionText, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;

    const updatedMessages = [...messages, { role: 'user' as const, content }];
    setMessages(updatedMessages);
    setInput('');
    setError('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat/exam-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          examContext: {
            ...examContext,
            ...(activeQuestionText ? { currentQuestionText: activeQuestionText } : {}),
          },
        }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Failed to contact the exam assistant.');
      if (!data.reply) throw new Error('The exam assistant returned an invalid response.');
      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to contact the exam assistant.');
    } finally {
      setIsSending(false);
    }
  };

  const copyReply = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessage(index);
      window.setTimeout(() => setCopiedMessage(null), 1500);
    } catch {
      setError('Could not copy the suggestion. Please select and copy it manually.');
    }
  };

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/50">
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <h2 className="font-semibold text-gray-900">AI Assistant</h2>
          <p className="mt-1 text-sm text-gray-600">
            Refine exam questions, rubrics, and marking schemes.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => onOpenChange(!isOpen)}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          {isOpen ? 'Hide assistant' : 'Open assistant'}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-blue-200 p-4">
          {activeQuestionIndex !== null && activeQuestionText && (
            <p className="mb-3 rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-900">
              Focusing on Question {activeQuestionIndex + 1}
            </p>
          )}
          <div
            aria-live="polite"
            className="mb-4 max-h-80 space-y-3 overflow-y-auto rounded-md border border-gray-200 bg-white p-3"
          >
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">
                Ask for help refining a question or creating clear marking criteria.
              </p>
            )}
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`rounded-md p-3 text-sm ${
                  message.role === 'user'
                    ? 'ml-6 bg-blue-50 text-gray-800'
                    : 'mr-6 border border-gray-200 bg-gray-50 text-gray-800'
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => void copyReply(message.content, index)}
                    className="mt-2 text-xs font-semibold text-primary hover:underline"
                  >
                    {copiedMessage === index ? 'Copied' : 'Copy suggestion'}
                  </button>
                )}
              </article>
            ))}
            {isSending && (
              <p role="status" className="flex items-center gap-2 text-sm text-gray-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                Thinking…
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <label htmlFor="exam-assistant-input" className="sr-only">
              Message the AI Assistant
            </label>
            <textarea
              id="exam-assistant-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={5000}
              rows={2}
              placeholder="Ask about a question, rubric, or marking scheme…"
              className="min-w-0 flex-1 resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
