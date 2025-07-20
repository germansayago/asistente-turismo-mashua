// /app/page.tsx
"use client"; // Directiva para componentes de cliente en App Router

import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState<
    { text: string; sender: "user" | "bot" }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user" as const };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          chat_history: messages,
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
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          height: "70vh",
          border: "1px solid #ccc",
          overflowY: "auto",
          padding: "20px",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              margin: "20px 0",
            }}
          >
            <span
              style={{
                background: msg.sender === "user" ? "#007bff" : "#e9e9eb",
                color: msg.sender === "user" ? "white" : "black",
                padding: "4px",
                borderRadius: "10px",
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
        {isLoading && (
          <div style={{ textAlign: "left", margin: "10px 0" }}>...</div>
        )}
      </div>
      <div style={{ display: "flex", marginTop: "10px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyUp={(e) => e.key === "Enter" && handleSend()}
          style={{ flexGrow: 1, padding: "10px" }}
          placeholder="Pregunta por nuestros paquetes..."
        />
        <button onClick={handleSend} style={{ padding: "10px 20px" }}>
          Enviar
        </button>
      </div>
    </div>
  );
}
