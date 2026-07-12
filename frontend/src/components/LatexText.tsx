import { Fragment } from 'react';
import { InlineMath } from 'react-katex';

interface LatexTextProps {
  content: string | null | undefined;
  className?: string;
}

const LATEX_TOKEN_REGEX = /(\$\$[\s\S]+?\$\$|\$[^$\r\n]+\$)/g;

function renderInlineToken(token: string, index: number) {
  if (token.startsWith('$$') && token.endsWith('$$')) {
    const expression = token.slice(2, -2).trim();
    return expression ? <InlineMath key={`latex-${index}`}>{expression}</InlineMath> : null;
  }

  if (token.startsWith('$') && token.endsWith('$')) {
    const expression = token.slice(1, -1).trim();
    return expression ? <InlineMath key={`latex-${index}`}>{expression}</InlineMath> : null;
  }

  return <Fragment key={`text-${index}`}>{token}</Fragment>;
}

export default function LatexText({ content, className }: LatexTextProps) {
  if (!content) return null;

  const parts = content.split(LATEX_TOKEN_REGEX).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((part, index) => renderInlineToken(part, index))}
    </span>
  );
}
