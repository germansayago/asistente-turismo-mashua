// Componente que renderiza un ícono de chat en formato SVG.
// Se usa como un componente interno de la burbuja del chat.
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

// Definimos las propiedades que acepta el componente ChatBubble.
// En este caso, solo una función `onClick`.
interface ChatBubbleProps {
  onClick: () => void;
}

// Componente principal: una burbuja flotante para abrir el chat.
// Es un botón que se posiciona en la esquina inferior derecha de la pantalla.
export const ChatBubble = ({ onClick }: ChatBubbleProps) => {
  return (
    <button
      onClick={onClick} // Llama a la función proporcionada para abrir/cerrar el chat
      className="fixed bottom-5 right-5 w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg z-50 transition-transform duration-200 hover:scale-110"
      aria-label="Abrir chat" // Etiqueta para accesibilidad
    >
      <ChatIcon /> {/* Usamos el ícono de chat */}
    </button>
  );
};
