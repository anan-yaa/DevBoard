"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const s = io(SOCKET_URL);

    const onReceiveMessage = (data: { message?: unknown }) => {
      if (typeof data?.message === "string") {
        setMessages((prev: string[]) => [...prev, data.message as string]);
      }
    };

    s.on("receive-message", onReceiveMessage);
    setSocket(s);

    return () => {
      s.off("receive-message", onReceiveMessage);
      s.close();
    };
  }, []);

  const joinRoom = () => {
    const id = roomIdInput.trim();
    if (!socket || !id) return;
    socket.emit("join-room", id);
    setActiveRoomId(id);
  };

  const sendMessage = () => {
    const text = messageDraft.trim();
    if (!socket || !activeRoomId || !text) return;
    socket.emit("send-message", { roomId: activeRoomId, message: text });
    setMessageDraft("");
  };

  return (
    <main style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Socket chat</h1>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4 }}>Room ID</label>
        <input
          value={roomIdInput}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setRoomIdInput(e.target.value)
          }
          placeholder="e.g. lobby"
          style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
        />
        <button type="button" onClick={joinRoom} style={{ marginTop: 8 }}>
          Join room
        </button>
        {activeRoomId ? (
          <p style={{ marginTop: 8, fontSize: 14, color: "#444" }}>
            Joined: <strong>{activeRoomId}</strong>
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4 }}>Message</label>
        <input
          value={messageDraft}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setMessageDraft(e.target.value)
          }
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="Type a message"
          style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
        />
        <button type="button" onClick={sendMessage} style={{ marginTop: 8 }}>
          Send
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: "1rem", marginBottom: 8 }}>Messages</h2>
        {messages.length === 0 ? (
          <p style={{ fontSize: 14, color: "#666" }}>No messages yet.</p>
        ) : (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {messages.map((m: string, i: number) => (
              <li key={`${i}-${m}`} style={{ marginBottom: 4 }}>
                {m}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
