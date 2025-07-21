import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { RefObject } from "react";

// Definimos el tipo de mensaje y las propiedades del componente ChatWindow.
type Message = { text: string; sender: "user" | "bot" };

interface ChatWindowProps {
  isOpen: boolean; // Controla la visibilidad de la ventana
  onClose: () => void; // Función para cerrar la ventana
  messages: Message[]; // Array de mensajes del chat
  input: string; // Valor actual del input de texto
  setInput: (value: string) => void; // Función para actualizar el input
  handleSend: () => void; // Función para enviar el mensaje
  isLoading: boolean; // Indica si se está cargando una respuesta
  chatContainerRef: RefObject<HTMLDivElement | null>; // Referencia para el contenedor de mensajes
  inputRef: RefObject<HTMLInputElement | null>; // Referencia para el campo de input
}

// Componente principal de la ventana del chat.
// Gestiona el estado de visibilidad y agrupa otros componentes (Header, Lista de mensajes, Input).
export const ChatWindow = ({
  isOpen,
  onClose,
  messages,
  input,
  setInput,
  handleSend,
  isLoading,
  chatContainerRef,
  inputRef,
}: ChatWindowProps) => {
  return (
    // El div principal controla la posición y la animación de la ventana.
    // Las clases dinámicas controlan la visibilidad y el movimiento.
    <div
      className={`fixed bottom-24 right-5 w-[370px] h-[70vh] max-h-[600px] bg-white rounded-xl shadow-2xl flex flex-col z-50 transition-all duration-300 ease-in-out ${
        isOpen
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      {/* Componente del encabezado del chat */}
      <ChatHeader onClose={onClose} />

      {/* Componente que muestra la lista de mensajes */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        chatContainerRef={chatContainerRef}
      />

      {/* Componente de entrada de texto y botón de enviar */}
      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
        inputRef={inputRef}
      />
    </div>
  );
};
