import React, { useEffect, useRef, useState } from "react";
import { observeAvatarMotion, avatarMotionTiming } from "./avatar-motion.mjs";
import {
  agentAvatar,
  avatarColor,
  avatarBackground,
} from "./agent-avatars.mjs";
import nori from "./assets/avatars/faces/nori.svg";
import orbit from "./assets/avatars/faces/orbit.svg";
import miko from "./assets/avatars/faces/miko.svg";
import pixel from "./assets/avatars/faces/pixel.svg";
import lumi from "./assets/avatars/faces/lumi.svg";
import kibo from "./assets/avatars/faces/kibo.svg";
import "./agent-profile.css";
import pebble from "./assets/avatars/faces/pebble.svg";
import pad from "./assets/avatars/faces/pad.svg";
const artwork = { nori, orbit, miko, pixel, lumi, kibo, pebble, pad };
export function Avatar({ avatar, color, large = false, motion = undefined }) {
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
      data-avatar-style={motion}
      data-avatar-color={avatarColor(color)}
      style={{ background: avatarBackground(color), ...timing }}
    >
      <span
        className="agent-avatar-art"
        // Only the eight trusted, bundled SVGs above can supply this markup.
        dangerouslySetInnerHTML={{ __html: artwork[id] }}
      />
    </span>
  );
}
