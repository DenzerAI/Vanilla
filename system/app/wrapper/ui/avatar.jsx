import React, { useEffect, useRef, useState } from "react";
import { observeAvatarMotion, avatarMotionTiming } from "./avatar-motion.mjs";
import {
  agentAvatar,
  avatarColor,
  avatarBackground,
} from "./agent-avatars.mjs";
import nori from "./assets/avatars/nori.svg";
import orbit from "./assets/avatars/orbit.svg";
import miko from "./assets/avatars/miko.svg";
import pixel from "./assets/avatars/pixel.svg";
import lumi from "./assets/avatars/lumi.svg";
import kibo from "./assets/avatars/kibo.svg";
import "./agent-profile.css";
const artwork = { nori, orbit, miko, pixel, lumi, kibo };
export function Avatar({ avatar, color, large = false }) {
  const { id } = agentAvatar(avatar);
  const ref = useRef();
  const [timing] = useState(avatarMotionTiming);
  useEffect(() => observeAvatarMotion(ref.current), []);
  return (
    <span
      ref={ref}
      className={large ? "identity-avatar" : "avatar"}
      aria-hidden="true"
      data-avatar={id}
      data-avatar-color={avatarColor(color)}
      style={{ background: avatarBackground(color), ...timing }}
    >
      <span
        className="agent-avatar-art"
        // Only the six trusted, bundled SVGs above can supply this markup.
        dangerouslySetInnerHTML={{ __html: artwork[id] }}
      />
    </span>
  );
}
