"use client";
import { useState, useEffect, useRef } from "react";
import { ChatBubble } from "./components/ChatBubble";
import { ChatWindow } from "./components/ChatWindow";
import { v4 as uuidv4 } from "uuid"; // Importa la función para generar IDs únicos

export default function Home() {
  type Message = { text: string; sender: "user" | "bot" };

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "¡Hola! Soy tu asistente de viajes. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Estado para almacenar el ID del usuario
  const [userId, setUserId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // useEffect para manejar el scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // useEffect para enfocar el input
  useEffect(() => {
    if (isOpen && !isLoading && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isLoading, messages]);

  // NUEVO useEffect para gestionar el ID del usuario
  useEffect(() => {
    let storedUserId = localStorage.getItem("chat_user_id");

    if (!storedUserId) {
      storedUserId = uuidv4();
      localStorage.setItem("chat_user_id", storedUserId);
    }

    setUserId(storedUserId);
  }, []); // El array vacío asegura que este efecto solo se ejecute una vez al montar el componente

  const handleSend = async () => {
    // Verificamos que el ID del usuario exista antes de enviar
    if (!input.trim() || isLoading || !userId) return;

    const userMessage = { text: input, sender: "user" as const };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          chat_history: messages,
          userId: userId, // <-- ¡Aquí se envía el userId!
        }),
      });
      if (!response.ok) throw new Error("Network response was not ok");
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

      <ChatBubble onClick={() => setIsOpen(!isOpen)} />

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
