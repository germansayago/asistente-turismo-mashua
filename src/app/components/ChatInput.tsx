import { RefObject } from "react";

// Definimos las propiedades que acepta el componente de entrada del chat.
interface ChatInputProps {
  input: string; // El valor actual del campo de entrada
  setInput: (value: string) => void; // Función para actualizar el valor del input
  handleSend: () => void; // Función para enviar el mensaje
  isLoading: boolean; // Indica si se está esperando una respuesta del bot
  inputRef: RefObject<HTMLInputElement | null>; // Referencia para controlar el input
}

// Componente de entrada del chat que incluye el campo de texto y el botón de enviar.
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
          onChange={(e) => setInput(e.target.value)} // Actualiza el estado con cada cambio
          onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSend()} // Envía el mensaje al presionar Enter
          placeholder="Escribe tu mensaje..."
          disabled={isLoading} // Deshabilita el input mientras se espera una respuesta
          className="flex-grow p-2 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
        <button
          onClick={handleSend} // Llama a la función handleSend al hacer clic
          disabled={isLoading} // Deshabilita el botón mientras se espera una respuesta
          className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:bg-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Enviar mensaje" // Etiqueta para accesibilidad
        >
          {/* Ícono de enviar en formato SVG */}
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
