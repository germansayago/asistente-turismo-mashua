import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { LegacyRef } from "react";

type Message = { text: string; sender: "user" | "bot" };

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  isLoading: boolean;
  chatContainerRef: LegacyRef<HTMLDivElement> | undefined;
}

export const ChatWindow = ({
  isOpen,
  onClose,
  messages,
  input,
  setInput,
  handleSend,
  isLoading,
  chatContainerRef,
}: ChatWindowProps) => {
  return (
    <div
      className={`fixed bottom-24 right-5 w-[350px] h-[70vh] max-h-[600px] bg-white rounded-xl shadow-2xl flex flex-col z-50 transition-all duration-300 ease-in-out ${
        isOpen
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <ChatHeader onClose={onClose} />
      <MessageList
        messages={messages}
        isLoading={isLoading}
        chatContainerRef={chatContainerRef}
      />
      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
};
