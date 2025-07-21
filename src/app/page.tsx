"use client";
// Importamos las librerías y componentes necesarios
import { useState, useEffect, useRef } from "react";
import { ChatBubble } from "./components/ChatBubble";
import { ChatWindow } from "./components/ChatWindow";
import { v4 as uuidv4 } from "uuid";

// Componente principal de la página
export default function Home() {
  // Definimos el tipo de mensaje para el chat
  type Message = { text: string; sender: "user" | "bot" };

  // Estados del componente
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "¡Hola! Soy tu asistente de viajes. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Referencias para manipular elementos del DOM
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Efecto para hacer scroll al final de la ventana de chat cuando se añaden nuevos mensajes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Efecto para enfocar el input de texto cuando se abre el chat o se carga una respuesta
  useEffect(() => {
    if (isOpen && !isLoading && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isLoading, messages]);

  // Efecto para gestionar el ID de usuario anónimo
  // Se ejecuta solo una vez al cargar la página.
  useEffect(() => {
    // Intenta recuperar el ID del usuario de localStorage
    let storedUserId = localStorage.getItem("chat_user_id");
    // Si no existe, genera uno nuevo y lo guarda
    if (!storedUserId) {
      storedUserId = uuidv4();
      localStorage.setItem("chat_user_id", storedUserId);
    }
    // Almacena el ID en el estado del componente
    setUserId(storedUserId);
  }, []);

  // Función para manejar el envío de mensajes
  const handleSend = async () => {
    // Si el input está vacío, el chat está cargando o no hay userId, no hacemos nada
    if (!input.trim() || isLoading || !userId) return;

    // Añade el mensaje del usuario al historial
    const userMessage = { text: input, sender: "user" as const };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Realiza la llamada a la API del backend
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          chat_history: messages,
          userId: userId, // <-- Incluye el userId en la solicitud
        }),
      });

      if (!response.ok) throw new Error("Network response was not ok");

      // Procesa la respuesta del agente
      const data = await response.json();
      const botMessage = { text: data.answer, sender: "bot" as const };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      const errorMessage = {
        text: "Lo siento, no pude procesar tu solicitud.",
        sender: "bot" as const,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-[100vh] bg-gray-100 p-5">
      <h1 className="text-3xl font-bold">Página de Contenido</h1>
      <p>Aquí iría el contenido de la web.</p>

      {/* Componente que representa la burbuja del chat */}
      <ChatBubble onClick={() => setIsOpen(!isOpen)} />

      {/* Ventana de chat que se muestra/oculta */}
      <ChatWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
        chatContainerRef={chatContainerRef}
        inputRef={inputRef}
      />
    </main>
  );
}
