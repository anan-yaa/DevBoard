"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const SOCKET_URL = "http://localhost:5000";
const DEFAULT_VALUE = "// Start coding...";
const EMIT_DEBOUNCE_MS = 150;

export default function EditorPage() {
  const [content, setContent] = useState(DEFAULT_VALUE);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When we apply code from the server, the next onChange may be that same text — do not emit again. */
  const skipEmitForValueRef = useRef<string | null>(null);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const onReceiveMessage = (data: { message?: unknown }) => {
      if (typeof data?.message !== "string") return;
      skipEmitForValueRef.current = data.message;
      setContent(data.message);
    };

    socket.on("receive-message", onReceiveMessage);

    return () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
      socket.off("receive-message", onReceiveMessage);
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback(() => {
    const id = roomIdInput.trim();
    const socket = socketRef.current;
    if (!socket || !id) return;
    socket.emit("join-room", id);
    setActiveRoomId(id);
  }, [roomIdInput]);

  const handleChange = useCallback((value: string | undefined) => {
    const next = value ?? "";
    setContent(next);

    if (
      skipEmitForValueRef.current !== null &&
      skipEmitForValueRef.current === next
    ) {
      skipEmitForValueRef.current = null;
      return;
    }

    if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    emitTimerRef.current = setTimeout(() => {
      emitTimerRef.current = null;
      const socket = socketRef.current;
      const roomId = activeRoomIdRef.current;
      if (!socket?.connected || !roomId) return;
      socket.emit("send-message", { roomId, message: next });
    }, EMIT_DEBOUNCE_MS);
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: 8,
          borderBottom: "1px solid #ccc",
        }}
      >
        <input
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          placeholder="Room ID"
          style={{ padding: 6, minWidth: 140 }}
        />
        <button type="button" onClick={joinRoom}>
          Join room
        </button>
        {activeRoomId ? (
          <span style={{ fontSize: 14, color: "#444" }}>
            Room: <strong>{activeRoomId}</strong>
          </span>
        ) : null}
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={content}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
