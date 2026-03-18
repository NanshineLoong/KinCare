import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatOverlay, type ChatMessage } from "./ChatOverlay";

vi.mock("./ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

function renderOverlay(messages: ChatMessage[]) {
  return render(
    <ChatOverlay
      draft=""
      error={null}
      isBusy={false}
      memberOptions={[]}
      messages={messages}
      onAudioUpload={() => {}}
      onClose={() => {}}
      onConfirmToolDraft={() => {}}
      onDraftChange={() => {}}
      onMemberChange={() => {}}
      onSend={() => {}}
      selectedMemberId=""
      toolCards={[]}
    />,
  );
}

describe("ChatOverlay", () => {
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
});
