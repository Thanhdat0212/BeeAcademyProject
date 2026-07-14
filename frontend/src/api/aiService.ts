import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRoadmap {
  summary: string;
  strengths: string[];
  improvements: string[];
  weeklyPlan: Array<{
    week: number;
    focus: string;
    activities: string[];
  }>;
}

// Gemini có thể mất >15s (timeout mặc định của apiClient) — nới riêng cho AI,
// và phải LỚN HƠN timeout Gemini phía backend (60s) để nhận lỗi tiếng Việt
// từ server thay vì lỗi mạng chung chung.
const CHAT_CONFIG = { timeout: 75_000 };
const ROADMAP_CONFIG = { timeout: 90_000 };

export async function sendAiChat(messages: AiChatMessage[]): Promise<string> {
  const response = await apiClient.post<ApiResponse<string>>(
    '/api/student/ai/chat',
    { messages },
    CHAT_CONFIG,
  );
  return unwrap(response.data);
}

export async function getAiRoadmap(): Promise<string> {
  const response = await apiClient.get<ApiResponse<string>>(
    '/api/student/ai/roadmap',
    ROADMAP_CONFIG,
  );
  return unwrap(response.data);
}

// Gemini có thể bọc JSON trong ```json ...``` hoặc kèm text thừa —
// cắt đúng phần object đầu tiên rồi parse, hỏng thì trả null để UI hiện raw text.
export function parseRoadmap(rawText: string): AiRoadmap | null {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(rawText.slice(start, end + 1)) as Partial<AiRoadmap>;
    if (!parsed.summary || !Array.isArray(parsed.weeklyPlan)) return null;
    return {
      summary: parsed.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      weeklyPlan: parsed.weeklyPlan.map((week, index) => ({
        week: typeof week.week === 'number' ? week.week : index + 1,
        focus: week.focus ?? '',
        activities: Array.isArray(week.activities) ? week.activities : [],
      })),
    };
  } catch {
    return null;
  }
}
