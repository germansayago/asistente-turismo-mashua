const ChatIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

interface ChatBubbleProps {
  onClick: () => void;
}

export const ChatBubble = ({ onClick }: ChatBubbleProps) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-5 right-5 w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg z-50 transition-transform duration-200 hover:scale-110"
      aria-label="Abrir chat"
    >
      <ChatIcon />
    </button>
  );
};
