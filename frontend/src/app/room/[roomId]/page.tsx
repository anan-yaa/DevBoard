"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const SOCKET_URL = "http://localhost:5000";
const DEFAULT_VALUE = "// Start coding...";
const EMIT_DEBOUNCE_MS = 150;

function roomIdFromParams(params: ReturnType<typeof useParams>): string | null {
  const raw = params.roomId;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return null;
}

export default function RoomEditorPage() {
  const params = useParams();
  const roomId = roomIdFromParams(params);

  const [content, setContent] = useState(DEFAULT_VALUE);
  const [roomUsers, setRoomUsers] = useState<string[]>([]);
  const [presenceLog, setPresenceLog] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipEmitForValueRef = useRef<string | null>(null);
  const prevRoomUsersRef = useRef<string[]>([]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    setContent(DEFAULT_VALUE);
    setRoomUsers([]);
    setPresenceLog([]);
    prevRoomUsersRef.current = [];

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const onReceiveMessage = (data: { message?: unknown }) => {
      if (typeof data?.message !== "string") return;
      skipEmitForValueRef.current = data.message;
      setContent(data.message);
    };

    const onRoomUsers = (data: { socketIds?: unknown }) => {
      const raw = data?.socketIds;
      if (
        !Array.isArray(raw) ||
        !raw.every((id): id is string => typeof id === "string")
      ) {
        return;
      }
      const next = raw;
      const prev = prevRoomUsersRef.current;
      prevRoomUsersRef.current = next;
      setRoomUsers(next);

      if (prev.length === 0) return;

      const prevSet = new Set(prev);
      const nextSet = new Set(next);
      const joined = next.filter((id) => !prevSet.has(id));
      const left = prev.filter((id) => !nextSet.has(id));
      const lines = [
        ...joined.map((id) => `User joined · ${id}`),
        ...left.map((id) => `User left · ${id}`),
      ];
      if (lines.length) {
        setPresenceLog((log) => [...log, ...lines].slice(-40));
      }
    };

    socket.on("receive-message", onReceiveMessage);
    socket.on("room-users", onRoomUsers);

    const join = () => {
      socket.emit("join-room", roomId);
    };
    if (socket.connected) join();
    else socket.on("connect", join);

    return () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
      socket.off("receive-message", onReceiveMessage);
      socket.off("room-users", onRoomUsers);
      socket.off("connect", join);
      socket.close();
      socketRef.current = null;
    };
  }, [roomId]);

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
      const id = roomIdRef.current;
      if (!socket?.connected || !id) return;
      socket.emit("send-message", { roomId: id, message: next });
    }, EMIT_DEBOUNCE_MS);
  }, []);

  if (!roomId) {
    return (
      <p style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        Invalid room URL.
      </p>
    );
  }

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
          padding: "8px 12px",
          borderBottom: "1px solid #ccc",
          fontSize: 14,
          color: "#444",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Room: <strong>{roomId}</strong>
        {" · "}
        <span>{roomUsers.length} user{roomUsers.length === 1 ? "" : "s"}</span>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={content}
            onChange={handleChange}
          />
        </div>

        <aside
          style={{
            width: 240,
            flexShrink: 0,
            borderLeft: "1px solid #ccc",
            padding: 12,
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            overflow: "auto",
            background: "#fafafa",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            In room ({roomUsers.length})
          </p>
          <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
            {roomUsers.map((id) => (
              <li key={id} style={{ wordBreak: "break-all", marginBottom: 4 }}>
                {id}
              </li>
            ))}
          </ul>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Activity</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#555" }}>
            {presenceLog.map((line, i) => (
              <li key={`${i}-${line}`} style={{ marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
