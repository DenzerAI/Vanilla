import React, { useRef, useState, useEffect } from "react";
import { Mic, PhoneOff, LoaderCircle, AudioLines } from "./icons.jsx";

export function Voice({ api, prepareChat, notify, disabled = false, chatId }) {
  const [state, setState] = useState("idle");
  const session = useRef(null),
    generation = useRef(0);
  const cleanup = async () => {
    generation.current++;
    const s = session.current;
    session.current = null;
    s?.stream?.getTracks().forEach((t) => t.stop());
    s?.peer?.close();
    if (s?.audio) {
      s.audio.pause();
      s.audio.srcObject = null;
    }
    if (s?.id) await api("/voice/stop", { id: s.id }).catch(() => {});
    setState("idle");
  };
  useEffect(
    () => () => {
      void cleanup();
    },
    [],
  );
  useEffect(() => {
    if (disabled || (session.current?.id && session.current.id !== chatId))
      void cleanup();
  }, [disabled, chatId]);
  async function start() {
    if (state !== "idle") return cleanup();
    const g = ++generation.current;
    setState("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Dieser Browser unterstützt keinen Mikrofonzugriff.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (g !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const peer = new RTCPeerConnection();
      const audio = new Audio();
      audio.autoplay = true;
      const s = { peer, stream, audio, id: null };
      session.current = s;
      peer.ontrack = (e) => {
        audio.srcObject = e.streams[0];
        audio
          .play()
          .catch(() => notify("Audiowiedergabe im Browser freigeben."));
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setState("live");
        if (peer.connectionState === "failed") {
          notify("Sprachverbindung unterbrochen.");
          void cleanup();
        }
      };
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      peer.createDataChannel("oai-events");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      s.id = await prepareChat();
      if (g !== generation.current) return;
      const r = await api("/voice/start", { id: s.id, sdp: offer.sdp });
      if (g !== generation.current) return;
      await peer.setRemoteDescription({ type: "answer", sdp: r.sdp });
    } catch (e) {
      await cleanup();
      notify(
        e.name === "NotAllowedError"
          ? "Mikrofonzugriff wurde nicht freigegeben."
          : e.message,
      );
    }
  }
  return (
    <div className="voice-control">
      {state !== "idle" && (
        <span className="voice-label">
          {state === "live" ? "Sprachchat aktiv" : "Verbinde …"}
        </span>
      )}
      <button
        type="button"
        disabled={disabled && state === "idle"}
        className={"icon-button " + (state === "live" ? "voice-live" : "")}
        aria-label={
          state === "idle" ? "Sprachchat starten" : "Sprachchat beenden"
        }
        title={
          disabled && state === "idle"
            ? "Im Planmodus den Textchat verwenden"
            : state === "idle"
              ? "Sprachchat über Codex (experimentell)"
              : "Sprachchat beenden"
        }
        onClick={start}
      >
        {state === "connecting" ? (
          <LoaderCircle size={18} />
        ) : state === "live" ? (
          <PhoneOff size={18} />
        ) : (
          <Mic size={18} />
        )}
      </button>
    </div>
  );
}
