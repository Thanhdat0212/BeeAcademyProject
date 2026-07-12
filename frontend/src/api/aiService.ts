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

export async function sendAiChat(messages: AiChatMessage[]): Promise<string> {
  const response = await apiClient.post<ApiResponse<string>>(
    '/api/student/ai/chat',
    { messages },
  );
  return unwrap(response.data);
}

export async function getAiRoadmap(): Promise<string> {
  const response = await apiClient.get<ApiResponse<string>>('/api/student/ai/roadmap');
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
