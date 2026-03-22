"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";

import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const SOCKET_URL = "http://localhost:5000";
const DEFAULT_VALUE = "// Start coding...";
const EMIT_DEBOUNCE_MS = 150;

type CursorPos = { lineNumber: number; column: number };

function roomIdFromParams(params: ReturnType<typeof useParams>): string | null {
  const raw = params.roomId;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return null;
}

function peerColorClass(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return `peer-caret-${Math.abs(h) % 6}`;
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

  /** Remote users' cursors only — updated on socket events; no React state to avoid re-renders. */
  const peerCursorsRef = useRef<Record<string, CursorPos>>({});
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const cursorListenerDisposableRef = useRef<{ dispose: () => void } | null>(
    null,
  );
  const cursorRafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<CursorPos | null>(null);

  const applyPeerDecorationsRef = useRef<() => void>(() => {});

  const applyPeerDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const selfId = socketRef.current?.id;
    const decs: editor.IModelDeltaDecoration[] = [];

    for (const [userId, pos] of Object.entries(peerCursorsRef.current)) {
      if (userId === selfId) continue;

      const lineCount = model.getLineCount();
      const line = Math.min(Math.max(1, pos.lineNumber), lineCount);
      const maxCol = model.getLineMaxColumn(line);
      const col = Math.min(Math.max(1, pos.column), maxCol);
      const color = peerColorClass(userId);

      if (col < maxCol) {
        decs.push({
          range: new monaco.Range(line, col, line, col + 1),
          options: {
            stickiness:
              monaco.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
            inlineClassName: `peer-caret ${color}`,
          },
        });
      } else {
        decs.push({
          range: new monaco.Range(line, col, line, col),
          options: {
            stickiness:
              monaco.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
            before: {
              content: "\u200b",
              inlineClassName: `peer-caret-eol ${color}`,
            },
          },
        });
      }
    }

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decs,
    );
  }, []);

  useLayoutEffect(() => {
    applyPeerDecorationsRef.current = applyPeerDecorations;
  }, [applyPeerDecorations]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    setContent(DEFAULT_VALUE);
    setRoomUsers([]);
    setPresenceLog([]);
    prevRoomUsersRef.current = [];
    peerCursorsRef.current = {};
    decorationIdsRef.current = [];

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

      for (const uid of Object.keys(peerCursorsRef.current)) {
        if (!next.includes(uid)) {
          delete peerCursorsRef.current[uid];
        }
      }
      applyPeerDecorationsRef.current();

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

    const onCursorUpdate = (data: {
      userId?: unknown;
      position?: unknown;
    }) => {
      if (typeof data.userId !== "string") return;
      const pos = data.position;
      if (!pos || typeof pos !== "object") return;
      const { lineNumber, column } = pos as Record<string, unknown>;
      if (typeof lineNumber !== "number" || typeof column !== "number") {
        return;
      }
      peerCursorsRef.current[data.userId] = { lineNumber, column };
      applyPeerDecorationsRef.current();
    };

    socket.on("receive-message", onReceiveMessage);
    socket.on("room-users", onRoomUsers);
    socket.on("cursor-update", onCursorUpdate);

    const join = () => {
      socket.emit("join-room", roomId);
    };
    if (socket.connected) join();
    else socket.on("connect", join);

    return () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
      if (cursorRafRef.current !== null) {
        cancelAnimationFrame(cursorRafRef.current);
        cursorRafRef.current = null;
      }
      socket.off("receive-message", onReceiveMessage);
      socket.off("room-users", onRoomUsers);
      socket.off("cursor-update", onCursorUpdate);
      socket.off("connect", join);
      socket.close();
      socketRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    return () => {
      cursorListenerDisposableRef.current?.dispose();
      cursorListenerDisposableRef.current = null;
    };
  }, []);

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
      const sock = socketRef.current;
      const id = roomIdRef.current;
      if (!sock?.connected || !id) return;
      sock.emit("send-message", { roomId: id, message: next });
    }, EMIT_DEBOUNCE_MS);
  }, []);

  const handleEditorMount = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = ed;
      monacoRef.current = monaco;
      decorationIdsRef.current = [];

      cursorListenerDisposableRef.current?.dispose();
      cursorListenerDisposableRef.current = ed.onDidChangeCursorPosition(
        () => {
          const p = ed.getPosition();
          if (!p) return;
          pendingCursorRef.current = {
            lineNumber: p.lineNumber,
            column: p.column,
          };
          if (cursorRafRef.current !== null) return;
          cursorRafRef.current = requestAnimationFrame(() => {
            cursorRafRef.current = null;
            const pos = pendingCursorRef.current;
            pendingCursorRef.current = null;
            if (!pos) return;
            const sock = socketRef.current;
            const rid = roomIdRef.current;
            if (!sock?.connected || !rid) return;
            sock.emit("cursor-move", { roomId: rid, position: pos });
          });
        },
      );

      applyPeerDecorationsRef.current();
    },
    [],
  );

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
            key={roomId}
            height="100%"
            defaultLanguage="javascript"
            value={content}
            onChange={handleChange}
            onMount={handleEditorMount}
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
