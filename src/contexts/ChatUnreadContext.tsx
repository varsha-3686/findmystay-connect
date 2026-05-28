import { createContext, useContext, type ReactNode } from "react";

export interface ChatUnreadContextValue {
  refresh: () => Promise<void>;
  markGroupRead: (hostelId: string) => Promise<void>;
  markDmRead: (hostelId: string, conversationId: string) => Promise<void>;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null);

export function ChatUnreadProvider({
  value,
  children,
}: {
  value: ChatUnreadContextValue;
  children: ReactNode;
}) {
  return (
    <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>
  );
}

export function useChatUnreadContext() {
  return useContext(ChatUnreadContext);
}
