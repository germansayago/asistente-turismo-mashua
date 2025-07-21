import { RefObject } from "react";

// Definimos los tipos de datos para los mensajes y las propiedades del componente.
type Message = { text: string; sender: "user" | "bot" };

interface MessageListProps {
  messages: Message[]; // Array de mensajes a mostrar en el chat
  isLoading: boolean; // Indica si se está esperando una respuesta del bot
  chatContainerRef: RefObject<HTMLDivElement | null>; // Referencia al contenedor principal para el scroll
}

// Componente que renderiza la lista de mensajes del chat.
// Gestiona el historial de la conversación y el indicador de carga.
export const MessageList = ({
  messages,
  isLoading,
  chatContainerRef,
}: MessageListProps) => {
  return (
    // Contenedor principal de los mensajes.
    // La referencia 'chatContainerRef' es para el scroll automático.
    <div
      ref={chatContainerRef}
      className="flex-grow p-4 overflow-y-auto bg-gray-50"
    >
      {/* Mapeamos el array de mensajes para renderizar cada burbuja de chat */}
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex my-2 ${
            msg.sender === "user" ? "justify-end" : "justify-start" // Alinea los mensajes según el emisor
          }`}
        >
          <div
            className={`max-w-[80%] p-3 rounded-2xl ${
              msg.sender === "user"
                ? "bg-blue-600 text-white rounded-br-lg" // Estilo para mensajes de usuario
                : "bg-gray-200 text-gray-800 rounded-bl-lg" // Estilo para mensajes del bot
            }`}
          >
            <p className="text-sm">{msg.text}</p>
          </div>
        </div>
      ))}
      {/* Indicador de carga: se muestra solo cuando isLoading es true */}
      {isLoading && (
        <div className="flex justify-start my-2">
          <div className="max-w-[80%] p-3 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-lg">
            {/* Animación de tres puntos para indicar que el bot está escribiendo */}
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
