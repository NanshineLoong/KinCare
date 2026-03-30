import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "../preferences";
import { ChatOverlay, type ChatMessage } from "./ChatOverlay";

vi.mock("./ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

const defaultOverlayProps = {
  attachments: [] as never[],
  draft: "",
  error: null,
  isBusy: false,
  isUploading: false,
  memberOptions: [] as never[],
  onAttachmentRemove: () => {},
  onAttachmentUpload: () => {},
  onClose: () => {},
  onConfirmToolDraft: () => {},
  onDismissToolCard: () => {},
  onDraftChange: () => {},
  onMemberChange: () => {},
  onSend: () => {},
  selectedMemberId: "",
  toolCards: [] as never[],
};

function renderOverlay(messages: ChatMessage[]) {
  return render(
    <PreferencesProvider>
      <ChatOverlay
        {...defaultOverlayProps}
        messages={messages}
      />
    </PreferencesProvider>,
  );
}

function installScrollMetrics(panel: HTMLDivElement) {
  let scrollTopValue = 0;
  let scrollHeightValue = 1200;
  let clientHeightValue = 320;

  Object.defineProperty(panel, "scrollTop", {
    configurable: true,
    get: () => scrollTopValue,
    set: (value: number) => {
      scrollTopValue = value;
    },
  });
  Object.defineProperty(panel, "scrollHeight", {
    configurable: true,
    get: () => scrollHeightValue,
    set: (value: number) => {
      scrollHeightValue = value;
    },
  });
  Object.defineProperty(panel, "clientHeight", {
    configurable: true,
    get: () => clientHeightValue,
    set: (value: number) => {
      clientHeightValue = value;
    },
  });

  const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    if (typeof options === "number") {
      scrollTopValue = options;
      return;
    }
    scrollTopValue = options?.top ?? scrollHeightValue;
  });
  panel.scrollTo = scrollTo as typeof panel.scrollTo;

  return {
    scrollTo,
    setScrollTop(value: number) {
      scrollTopValue = value;
    },
    setScrollHeight(value: number) {
      scrollHeightValue = value;
    },
    setClientHeight(value: number) {
      clientHeightValue = value;
    },
  };
}

describe("ChatOverlay", () => {
  it("invokes onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <PreferencesProvider>
        <ChatOverlay
          {...defaultOverlayProps}
          messages={[]}
          onClose={onClose}
        />
      </PreferencesProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves the message timeline order instead of sorting by id prefix", () => {
    renderOverlay([
      {
        id: "user-200",
        role: "user",
        content: "先出现的用户消息",
        sortKey: 1,
      },
      {
        id: "assistant-100",
        role: "assistant",
        content: "后出现的助手消息",
        sortKey: 2,
      },
    ]);

    const userMessage = screen.getByText("先出现的用户消息");
    const assistantMessage = screen.getByText("后出现的助手消息");

    expect(
      userMessage.compareDocumentPosition(assistantMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders assistant content as markdown", () => {
    renderOverlay([
      {
        id: "assistant-1",
        role: "assistant",
        content: "这是 **重点**\n\n- 第一项\n- 第二项",
        sortKey: 1,
      },
    ]);

    expect(screen.getByText("重点").tagName).toBe("STRONG");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("keeps user content as plain text instead of markdown", () => {
    renderOverlay([
      {
        id: "user-1",
        role: "user",
        content: "这是 **重点**",
        sortKey: 1,
      },
    ]);

    expect(screen.getByText("这是 **重点**")).toBeInTheDocument();
    expect(screen.queryByText("重点", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("scrolls to the bottom when an existing conversation is restored", async () => {
    const view = renderOverlay([]);
    const panel = view.container.querySelector('[tabindex="-1"]') as HTMLDivElement | null;

    expect(panel).not.toBeNull();
    const metrics = installScrollMetrics(panel as HTMLDivElement);

    view.rerender(
      <PreferencesProvider>
        <ChatOverlay
          {...defaultOverlayProps}
          messages={[
            {
              id: "assistant-1",
              role: "assistant",
              content: "这是之前的上下文",
              sortKey: 1,
            },
          ]}
        />
      </PreferencesProvider>,
    );

    await waitFor(() => {
      expect(metrics.scrollTo).toHaveBeenCalled();
    });
    expect(panel?.scrollTop).toBe(1200);
  });

  it("follows streaming output until the user scrolls up, then resumes after returning to bottom", async () => {
    const initialMessages: ChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "第一段输出",
        sortKey: 1,
      },
    ];

    const view = renderOverlay(initialMessages);
    const panel = view.container.querySelector('[tabindex="-1"]') as HTMLDivElement | null;

    expect(panel).not.toBeNull();
    const metrics = installScrollMetrics(panel as HTMLDivElement);

    view.rerender(
      <PreferencesProvider>
        <ChatOverlay
          {...defaultOverlayProps}
          messages={[
            {
              id: "assistant-1",
              role: "assistant",
              content: "第一段输出，继续补充第二段",
              sortKey: 1,
            },
          ]}
        />
      </PreferencesProvider>,
    );

    await waitFor(() => {
      expect(metrics.scrollTo).toHaveBeenCalledTimes(1);
    });

    metrics.scrollTo.mockClear();
    metrics.setScrollTop(400);
    fireEvent.scroll(panel as HTMLDivElement);

    view.rerender(
      <PreferencesProvider>
        <ChatOverlay
          {...defaultOverlayProps}
          messages={[
            {
              id: "assistant-1",
              role: "assistant",
              content: "第一段输出，继续补充第二段和第三段",
              sortKey: 1,
            },
          ]}
        />
      </PreferencesProvider>,
    );

    await waitFor(() => {
      expect(metrics.scrollTo).not.toHaveBeenCalled();
    });

    metrics.setScrollTop(880);
    fireEvent.scroll(panel as HTMLDivElement);

    view.rerender(
      <PreferencesProvider>
        <ChatOverlay
          {...defaultOverlayProps}
          messages={[
            {
              id: "assistant-1",
              role: "assistant",
              content: "第一段输出，继续补充第二段和第三段以及第四段",
              sortKey: 1,
            },
          ]}
        />
      </PreferencesProvider>,
    );

    await waitFor(() => {
      expect(metrics.scrollTo).toHaveBeenCalledTimes(1);
    });
  });
});
