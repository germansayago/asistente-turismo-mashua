"use client";
import { useState, useEffect, useRef } from "react";
import { ChatBubble } from "./components/ChatBubble";
import { ChatWindow } from "./components/ChatWindow";

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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Enfoca el input cuando se abre la ventana o cuando termina de cargar una respuesta
    if (isOpen && !isLoading && inputRef.current) {
      // Usamos un pequeño timeout para asegurar que el input sea visible antes de enfocar
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isLoading, messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = { text: input, sender: "user" as const };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: input, chat_history: messages }),
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
    <main className="h-[200vh] bg-gray-100 p-5">
      <h1 className="text-3xl font-bold">Página de Contenido</h1>
      <p>Aquí iría el contenido de tu web.</p>

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
