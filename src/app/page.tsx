"use client";

import { useState, useEffect, useRef } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { ChatBubble } from "./components/ChatBubble";

export default function Home() {
  type Message = { text: string; sender: "user" | "bot" };

  // --- El estado y la lógica principal viven aquí ---
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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

  // --- La renderización es mucho más simple ---
  return (
    <main className="h-[100vh] bg-gray-100 p-5">
      <h1 className="text-3xl font-bold">Página de Contenido Principal</h1>
      <p>Aquí iría el contenido de tu web. El chat flotará sobre esto.</p>

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
      />
    </main>
  );
}
