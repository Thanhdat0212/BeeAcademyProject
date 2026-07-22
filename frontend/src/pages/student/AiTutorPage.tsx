import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Map,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import AiMessageContent from '../../components/AiMessageContent';
import { notify } from '../../lib/toast';
import { isApiError } from '../../api/client';
import {
  getAiRoadmap,
  parseRoadmap,
  sendAiChat,
  type AiChatMessage,
  type AiRoadmap,
} from '../../api/aiService';

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: AiTutorPage (UC22 + UC23)
//
// Hai tab:
//   'chat'    → UC22: trò chuyện với trợ lý AI (lịch sử giữ client-side,
//               gửi kèm mỗi request — backend stateless, không lưu DB)
//   'roadmap' → UC23: AI phân tích tiến độ học thật và sinh lộ trình 4 tuần
// ═══════════════════════════════════════════════════════════════════════════════

const SUGGESTED_QUESTIONS = [
  'Giải thích giúp mình định lý Pytago với ví dụ dễ hiểu',
  'Làm sao để học thuộc từ vựng tiếng Anh nhanh hơn?',
  'Meo làm bài văn nghị luận xã hội cho lớp 9?',
  'Cách cân bằng phương trình hóa học?',
];

function ChatBubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
          isUser
            ? 'bg-primary text-on-primary rounded-br-md'
            : 'bg-surface-container text-on-surface rounded-bl-md border border-outline-variant/30'
        }`}
      >
        {!isUser && (
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
            <Bot className="w-3.5 h-3.5" /> Bee AI
          </p>
        )}
        {isUser ? message.content : <AiMessageContent content={message.content} />}
      </div>
    </div>
  );
}

function RoadmapView({ roadmap }: { roadmap: AiRoadmap }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5">
        <h4 className="flex items-center gap-2 font-bold text-on-surface mb-2">
          <Sparkles className="w-4 h-4 text-primary" /> Nhận xét của AI
        </h4>
        <p className="text-sm text-on-surface-variant leading-relaxed">{roadmap.summary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roadmap.strengths.length > 0 && (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5">
            <h4 className="flex items-center gap-2 font-bold text-on-surface mb-3">
              <TrendingUp className="w-4 h-4 text-green-600" /> Điểm mạnh
            </h4>
            <ul className="space-y-2">
              {roadmap.strengths.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-on-surface-variant">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {roadmap.improvements.length > 0 && (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5">
            <h4 className="flex items-center gap-2 font-bold text-on-surface mb-3">
              <Lightbulb className="w-4 h-4 text-amber-600" /> Cần cải thiện
            </h4>
            <ul className="space-y-2">
              {roadmap.improvements.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-on-surface-variant">
                  <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-bold text-on-surface">
          <Map className="w-4 h-4 text-primary" /> Kế hoạch 4 tuần
        </h4>
        {roadmap.weeklyPlan.map(week => (
          <div
            key={week.week}
            className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-extrabold text-sm">
                T{week.week}
              </span>
              <p className="font-bold text-on-surface">{week.focus}</p>
            </div>
            <ul className="space-y-1.5 pl-1">
              {week.activities.map((activity, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-on-surface-variant">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiTutorPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'chat' | 'roadmap'>(
    searchParams.get('tab') === 'roadmap' ? 'roadmap' : 'chat',
  );
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [roadmap, setRoadmap] = useState<AiRoadmap | null>(null);
  const [roadmapRawText, setRoadmapRawText] = useState<string | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend(text?: string) {
    const question = (text ?? input).trim();
    if (!question || sending) return;
    const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      // Chỉ gửi 20 tin nhắn gần nhất để giữ payload nhỏ (backend giới hạn 30)
      const reply = await sendAiChat(nextMessages.slice(-20));
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      // Lỗi mạng/timeout: interceptor trong client.ts đã toast rồi — chỉ toast lỗi backend
      if (isApiError(err)) notify.error(err.message);
      setMessages(prev => prev.slice(0, -1));
      setInput(question);
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateRoadmap() {
    setLoadingRoadmap(true);
    try {
      const rawText = await getAiRoadmap();
      const parsed = parseRoadmap(rawText);
      setRoadmap(parsed);
      setRoadmapRawText(parsed ? null : rawText);
      if (!parsed) {
        notify.error('AI trả về định dạng không chuẩn — hiển thị dạng văn bản');
      }
    } catch (err: unknown) {
      // Lỗi mạng/timeout: interceptor trong client.ts đã toast rồi — chỉ toast lỗi backend
      if (isApiError(err)) notify.error(err.message);
    } finally {
      setLoadingRoadmap(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface font-sans flex flex-col">
      <DashboardHeader />
      <div className="border-b border-outline-variant/30 bg-gradient-to-r from-surface-container via-surface-container to-primary/10">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại khóa học
          </Link>
          <h1 className="flex items-center gap-2 font-extrabold text-on-surface">
            <Sparkles className="w-5 h-5 text-primary" /> Trợ lý AI
          </h1>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 flex flex-col px-4 py-6">
        <div className="flex gap-2 mb-6">
          {([
            { id: 'chat', label: 'Trò chuyện', icon: MessageSquare },
            { id: 'roadmap', label: 'Lộ trình học', icon: Map },
          ] as const).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 md:p-6 space-y-4 overflow-y-auto min-h-[400px] max-h-[60vh]">
                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <Bot className="w-12 h-12 mx-auto text-primary mb-3" />
                    <p className="font-bold text-on-surface mb-1">Chào bạn, mình là Bee AI!</p>
                    <p className="text-sm text-on-surface-variant mb-6">
                      Hỏi mình bất cứ điều gì về bài học, phương pháp học tập nhé.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTED_QUESTIONS.map(question => (
                        <button
                          key={question}
                          onClick={() => handleSend(question)}
                          className="px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <ChatBubble key={index} message={message} />
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-surface-container border border-outline-variant/30">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="mt-4 flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Nhập câu hỏi của bạn... (Enter để gửi)"
                  className="flex-1 rounded-2xl border border-outline-variant/50 bg-surface-container p-3.5 text-sm text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={sending || !input.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
                  aria-label="Gửi câu hỏi"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'roadmap' && (
            <motion.div
              key="roadmap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {!roadmap && !roadmapRawText && !loadingRoadmap && (
                <div className="text-center py-16 rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest">
                  <Map className="w-12 h-12 mx-auto text-primary mb-3" />
                  <p className="font-bold text-on-surface mb-1">Lộ trình học cá nhân hóa</p>
                  <p className="text-sm text-on-surface-variant mb-6 max-w-md mx-auto">
                    AI sẽ phân tích tiến độ học, điểm quiz của bạn và đề xuất kế hoạch
                    học tập 4 tuần phù hợp nhất.
                  </p>
                  <button
                    onClick={handleGenerateRoadmap}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4" /> Tạo lộ trình cho tôi
                  </button>
                </div>
              )}

              {loadingRoadmap && (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                  <p className="text-sm font-medium">AI đang phân tích tiến độ học của bạn...</p>
                </div>
              )}

              {!loadingRoadmap && (roadmap || roadmapRawText) && (
                <div className="space-y-6">
                  {roadmap && <RoadmapView roadmap={roadmap} />}
                  {roadmapRawText && (
                    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 text-sm text-on-surface leading-relaxed">
                      <AiMessageContent content={roadmapRawText} />
                    </div>
                  )}
                  <button
                    onClick={handleGenerateRoadmap}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/50 text-sm font-bold text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Tạo lại lộ trình
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
