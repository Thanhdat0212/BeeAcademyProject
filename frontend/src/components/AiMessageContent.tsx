import type { ReactNode } from 'react';

// Formatter nhẹ cho câu trả lời của Gemini — KHÔNG dùng thư viện markdown.
// System prompt đã yêu cầu AI trả văn bản thường, đây là fallback khi AI
// vẫn lỡ chèn markdown (###, **, `code`, danh sách - / *).
// Phần không khớp pattern render nguyên văn (graceful degradation).

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE_PATTERN).map((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return <strong key={key}>{segment.slice(2, -2)}</strong>;
    }
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-surface-container-high px-1 py-0.5 text-[0.85em]">
          {segment.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{segment}</span>;
  });
}

interface AiMessageContentProps {
  content: string;
}

export default function AiMessageContent({ content }: AiMessageContentProps) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets(key: string) {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer;
    bulletBuffer = [];
    blocks.push(
      <ul key={key} className="space-y-1 my-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>{renderInline(item, `${key}-li-${index}`)}</span>
          </li>
        ))}
      </ul>,
    );
  }

  lines.forEach((line, index) => {
    const key = `line-${index}`;
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      return;
    }
    flushBullets(`ul-before-${index}`);

    const headingMatch = line.match(/^#{1,3}\s+(.*)/);
    if (headingMatch) {
      blocks.push(
        <p key={key} className="font-bold mt-2">
          {renderInline(headingMatch[1], key)}
        </p>,
      );
      return;
    }
    if (line.trim() === '') {
      blocks.push(<div key={key} className="h-2" />);
      return;
    }
    blocks.push(<p key={key}>{renderInline(line, key)}</p>);
  });
  flushBullets('ul-tail');

  return <div className="space-y-0.5">{blocks}</div>;
}
