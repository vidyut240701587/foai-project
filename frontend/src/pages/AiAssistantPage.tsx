import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Copy, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiFetch } from '../lib/api';

type Message = {
  sender: 'user' | 'bot';
  text: string;
  mode?: string;
};

type AiChatResponse = {
  answer?: string;
  analysis?: string;
  recommendation?: string;
  sourceData?: string;
  message?: string;
  mode?: string;
};

const quickActions = [
  { label: '2-Mark Answer', mode: '2-mark', prompt: 'Give me a concise 2-mark answer on the key concept behind this topic: Java basics.' },
  { label: '11-Mark Answer', mode: '11-mark', prompt: 'Provide a well-structured 11-mark answer on the most important concept in this subject.' },
  { label: 'Explain Topic', mode: 'general', prompt: 'Explain the most important concept in my current syllabus in simple academic terms.' },
  { label: 'Important Topics', mode: 'important-topics', prompt: 'Identify the most important topics from my syllabus and explain why they matter.' },
  { label: 'Predict Questions', mode: 'predict-questions', prompt: 'Predict the most likely exam questions from my subject and explain the high-frequency areas.' },
  { label: 'Generate Quiz', mode: 'generate-quiz', prompt: 'Generate a short quiz with answers and explanations for my current subject.' },
  { label: 'Study Plan', mode: 'study-plan', prompt: 'Create a focused study plan from my syllabus with daily priorities and revision tasks.' },
] as const;

const starterMessages: Message[] = [
  { sender: 'bot', text: 'Ask me about your syllabus, topic importance, or what to revise today.' },
];

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-body space-y-4 text-left text-sm leading-7 text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => <h1 className="mt-4 text-2xl font-bold text-white" {...props} />,
          h2: ({ ...props }) => <h2 className="mt-4 text-xl font-bold text-white" {...props} />,
          h3: ({ ...props }) => <h3 className="mt-3 text-lg font-semibold text-indigo-200" {...props} />,
          h4: ({ ...props }) => <h4 className="mt-2 text-base font-semibold text-indigo-100" {...props} />,
          p: ({ ...props }) => <p className="text-slate-100" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc space-y-1 pl-5 text-slate-100" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal space-y-1 pl-5 text-slate-100" {...props} />,
          li: ({ ...props }) => <li className="leading-6" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
          em: ({ ...props }) => <em className="italic text-slate-200" {...props} />,
          a: ({ ...props }) => <a className="text-indigo-300 underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
          blockquote: ({ ...props }) => <blockquote className="border-l-2 border-indigo-500/60 pl-4 text-slate-300" {...props} />,
          table: ({ ...props }) => <div className="overflow-x-auto"><table className="min-w-full border border-slate-700 text-left text-sm" {...props} /></div>,
          thead: ({ ...props }) => <thead className="bg-slate-800 text-slate-200" {...props} />,
          th: ({ ...props }) => <th className="border border-slate-700 px-3 py-2 font-semibold" {...props} />,
          td: ({ ...props }) => <td className="border border-slate-700 px-3 py-2 align-top" {...props} />,
          code({ className, children, ...props }: any) {
            const code = String(children).replace(/\n$/, '');
            const isInline = !className && typeof children === 'string';
            if (isInline) {
              return <code className="rounded-md bg-slate-800 px-1.5 py-0.5 text-emerald-300" {...props}>{code}</code>;
            }
            const matchedLanguage = /language-(\w+)/.exec(className || '');
            const language = matchedLanguage ? matchedLanguage[1] : 'text';
            return <CodeBlock language={language} code={code} />;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-300">
        <span>{language}</span>
        <Button type="button" variant="ghost" size="sm" onClick={copyCode} className="h-7 rounded-lg px-2 py-1 text-[10px]">
          {copied ? 'Copied' : 'Copy code'}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus as any}
        customStyle={{ margin: 0, padding: '1rem', background: '#020817', fontSize: '0.82rem' }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function AiAssistantPage() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryMessage, setRetryMessage] = useState('');
  const [retryMode, setRetryMode] = useState('general');
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (prompt) setInput(prompt);
  }, [location.state]);

  useEffect(() => {
    apiFetch<{ configured: boolean }>('/health/ai').then((status) => setAiConfigured(status.configured)).catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    apiFetch<{ messages: Array<{ role: string; content: string }> }>('/ai/history')
      .then((history) => {
        if (history.messages.length) {
          setMessages([
            starterMessages[0],
            ...history.messages.map((message) => ({ sender: message.role === 'user' ? 'user' as const : 'bot' as const, text: message.content })),
          ]);
        }
      })
      .catch(() => undefined);
  }, []);

  const sendMessage = async (event?: FormEvent<HTMLFormElement>, retryText?: string, chosenMode = 'general') => {
    event?.preventDefault();
    const text = retryText ?? input.trim();
    if (!text || loading) return;

    if (!retryText) {
      setMessages((prev) => [...prev, { sender: 'user', text, mode: chosenMode }]);
      setInput('');
    }
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch<AiChatResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, mode: chosenMode }),
      });

      const reply = response.answer || response.message || response.recommendation || 'I need more context to answer accurately.';
      setMessages((prev) => [...prev, { sender: 'bot', text: reply, mode: chosenMode }]);
      setRetryMessage('');
      setRetryMode(chosenMode);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to generate response. Please try again.');
      setRetryMessage(text);
      setRetryMode(chosenMode);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: (typeof quickActions)[number]) => {
    void sendMessage(undefined, action.prompt, action.mode);
  };

  const copyAnswer = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op: clipboard errors are non-blocking
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-indigo-300">AI Assistant</p>
            <h1 className="mt-2 text-3xl font-bold text-white">AI Academic Assistant</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
            <Sparkles size={16} />
            {aiConfigured === null ? 'Checking AI' : aiConfigured ? 'Gemini AI ready' : 'AI not configured'}
          </div>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button key={action.label} type="button" variant="outline" size="sm" onClick={() => handleQuickAction(action)} disabled={loading}>
              {action.label}
            </Button>
          ))}
        </div>

        <Card className="overflow-hidden border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-2 text-indigo-200">
              <Bot size={18} />
              Gemini AI
            </div>
          </div>

          <div className="flex max-h-[620px] min-h-[420px] flex-col gap-4 overflow-y-auto bg-slate-950/60 p-4">
            {messages.map((message, index) => (
              <div key={`${message.sender}-${index}`} className={`max-w-[82%] rounded-2xl border p-4 ${message.sender === 'user' ? 'ml-auto border-indigo-500/60 bg-indigo-500 text-white' : 'mr-auto border-slate-800 bg-slate-900 text-slate-100'}`}>
                {message.sender === 'bot' && (
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.12em] text-indigo-200">
                    <span>AI Academic Assistant</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => copyAnswer(message.text)} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
                        <Copy size={13} /> Copy
                      </button>
                      <button type="button" onClick={() => void sendMessage(undefined, message.text, message.mode ?? 'general')} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
                        <RefreshCw size={13} /> Regenerate
                      </button>
                      <button type="button" onClick={() => setMessages((prev) => prev.filter((entry, itemIndex) => !(itemIndex === index && entry.sender === 'bot')))} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
                        <Trash2 size={13} /> Clear
                      </button>
                    </div>
                  </div>
                )}
                {message.sender === 'user' ? <div className="text-white">{message.text}</div> : <MarkdownRenderer content={message.text} />}
              </div>
            ))}
            {loading && <div role="status" className="mr-auto max-w-[82%] rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">Thinking...</div>}
            {error && (
              <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p>Unable to generate response. Please try again.</p>
                {retryMessage && (
                  <Button variant="outline" className="mt-3" onClick={() => void sendMessage(undefined, retryMessage, retryMode)} disabled={loading}>
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-900/70 p-4">
            <form className="flex gap-3" onSubmit={(event) => void sendMessage(event, undefined, 'general')}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Ask an academic question"
                placeholder="Ask: What is Java? Explain normalization..."
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500"
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send size={16} className="mr-2" />
                {loading ? 'Thinking...' : 'Send'}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
