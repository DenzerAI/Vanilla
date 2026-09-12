import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { observeAvatarMotion, avatarMotionTiming } from "./avatar-motion.mjs";
import {
  agentAvatar,
  avatarColor,
  avatarBackground,
  avatarCutout,
} from "./agent-avatars.mjs";
import lumi from "./assets/avatars/faces/lumi.svg";
import nori from "./assets/avatars/faces/nori.svg";
import miko from "./assets/avatars/faces/miko.svg";
import orbit from "./assets/avatars/faces/orbit.svg";
import pixel from "./assets/avatars/faces/pixel.svg";
import kibo from "./assets/avatars/faces/kibo.svg";
import "./agent-profile.css";
const artwork = { lumi, nori, miko, orbit, pixel, kibo };
// Die Bühne zeigt Requisiten links und rechts; kompakte Avatare beschneiden auf die Figur.
const STAGE_VIEWBOX = 'viewBox="-10 -8 31 25"';
const COMPACT_VIEWBOX = 'viewBox="-1 0 18 16"';
export const DEFAULT_AVATAR_SET = "ruhe";
export const Avatar = memo(function Avatar({ avatar, color, large = false, motion = undefined, set = DEFAULT_AVATAR_SET, stage = false }) {
  const { id } = agentAvatar(avatar);
  const ref = useRef();
  const [timing] = useState(avatarMotionTiming);
  useEffect(() => observeAvatarMotion(ref.current), []);
  const markup = stage ? artwork[id] : artwork[id].replace(STAGE_VIEWBOX, COMPACT_VIEWBOX);
  const artworkHTML = useMemo(() => ({ __html: markup }), [markup]);
  return (
    <span
      ref={ref}
      className={large ? "identity-avatar" : "avatar"}
      aria-hidden="true"
      data-avatar={id}
      data-avatar-style={motion}
      data-set={set}
      data-stage={stage ? "true" : undefined}
      data-avatar-color={avatarColor(color)}
      style={{ background: avatarBackground(color), "--avatar-cutout": avatarCutout(color), ...timing }}
    >
      <span
        className="agent-avatar-art"
        // Only the six trusted, bundled SVGs above can supply this markup.
        dangerouslySetInnerHTML={artworkHTML}
      />
    </span>
  );
});
