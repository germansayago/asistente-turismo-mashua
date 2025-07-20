import { RefObject } from "react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  isLoading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

export const ChatInput = ({
  input,
  setInput,
  handleSend,
  isLoading,
  inputRef,
}: ChatInputProps) => {
  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      <div className="flex items-center space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()}
          placeholder="Escribe tu mensaje..."
          disabled={isLoading}
          className="flex-grow p-2 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:bg-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Enviar mensaje"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
};
