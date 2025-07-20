import { LegacyRef } from "react";

type Message = { text: string; sender: "user" | "bot" };

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  chatContainerRef: LegacyRef<HTMLDivElement> | undefined;
}

export const MessageList = ({
  messages,
  isLoading,
  chatContainerRef,
}: MessageListProps) => {
  return (
    <div
      ref={chatContainerRef}
      className="flex-grow p-4 overflow-y-auto bg-gray-50"
    >
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex my-2 ${
            msg.sender === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`max-w-[80%] p-3 rounded-2xl ${
              msg.sender === "user"
                ? "bg-blue-600 text-white rounded-br-lg"
                : "bg-gray-200 text-gray-800 rounded-bl-lg"
            }`}
          >
            <p className="text-sm">{msg.text}</p>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start my-2">
          <div className="max-w-[80%] p-3 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-lg">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
