const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

interface ChatHeaderProps {
  onClose: () => void;
}

export const ChatHeader = ({ onClose }: ChatHeaderProps) => {
  return (
    <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-xl">
      <h3 className="text-lg font-semibold">Asistente de Viajes</h3>
      <button
        onClick={onClose}
        className="hover:opacity-75"
        aria-label="Cerrar chat"
      >
        <CloseIcon />
      </button>
    </div>
  );
};
