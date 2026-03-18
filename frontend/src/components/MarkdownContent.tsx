import { Fragment, type ReactNode } from "react";

type MarkdownContentProps = {
  className?: string;
  content: string;
};

type MarkdownBlock =
  | { type: "heading"; depth: number; content: string }
  | { type: "paragraph"; content: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

const INLINE_TOKEN_PATTERN =
  /(\*\*[^*\n]+?\*\*|`[^`\n]+?`|\[[^\]\n]+?\]\([^)]+\)|\*[^*\n]+?\*)/g;

function parseBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        depth: headingMatch[1].length,
        content: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const next = lines[index].trim();
        const listMatch = next.match(/^[-*+]\s+(.+)$/);
        if (!listMatch) {
          break;
        }
        items.push(listMatch[1]);
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const next = lines[index].trim();
        const listMatch = next.match(/^\d+\.\s+(.+)$/);
        if (!listMatch) {
          break;
        }
        items.push(listMatch[1]);
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const next = lines[index].trimEnd();
      const nextTrimmed = next.trim();
      if (
        !nextTrimmed ||
        /^(#{1,6})\s+/.test(nextTrimmed) ||
        /^[-*+]\s+/.test(nextTrimmed) ||
        /^\d+\.\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN_PATTERN)) {
    const token = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${start}-strong`}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`${start}-em`}>
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          className="rounded bg-[#F5F0EA] px-1.5 py-0.5 font-mono text-[0.95em]"
          key={`${start}-code`}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            className="text-[#356a94] underline underline-offset-2"
            href={linkMatch[2]}
            key={`${start}-link`}
            rel="noreferrer"
            target="_blank"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderParagraphLines(lines: string[]) {
  return lines.map((line, index) => (
    <Fragment key={`line-${index}`}>
      {renderInline(line)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

export function MarkdownContent({
  className = "",
  content,
}: MarkdownContentProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag =
            block.depth === 1
              ? "h1"
              : block.depth === 2
                ? "h2"
                : block.depth === 3
                  ? "h3"
                  : "h4";

          return (
            <HeadingTag
              className="mb-2 mt-4 font-semibold first:mt-0"
              key={`heading-${index}`}
            >
              {renderInline(block.content)}
            </HeadingTag>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" key={`ul-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" key={`ol-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`ol-item-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p className="mb-3 last:mb-0" key={`paragraph-${index}`}>
            {renderParagraphLines(block.content)}
          </p>
        );
      })}
    </div>
  );
}
