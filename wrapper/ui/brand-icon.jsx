import React from "react";
import { skillArt } from "./skill-art.mjs";
import a2a from "./assets/a2a.svg";
import github from "./assets/github.svg";
import groq from "./assets/groq.svg";
import gmail from "./assets/gmail.svg";
import outlook from "./assets/outlook.svg";
import whatsapp from "./assets/whatsapp.svg";
import twentyFirst from "./assets/21st.png";
import higgsfield from "./assets/higgsfield.png";
import elevenlabs from "./assets/elevenlabs.svg";
import n8n from "./assets/n8n.svg";
import hero from './assets/crm/hero.png';
import labelwin from './assets/crm/labelwin.png';
import plancraft from './assets/crm/plancraft.png';
import tooltime from './assets/crm/tooltime.png';
import openhandwerk from './assets/crm/openhandwerk.png';
import pds from './assets/crm/pds.png';
import streit from './assets/crm/streit.png';
import winworker from './assets/crm/winworker.png';
import weclapp from './assets/crm/weclapp.png';
import centralstationcrm from './assets/crm/centralstationcrm.svg';
import cas from './assets/crm/cas.png';
import cobra from './assets/crm/cobra.png';
import sap from './assets/crm/sap.svg';
import telegram from './assets/telegram.svg';
import discord from './assets/discord.svg';
import openai from './assets/openai.svg';
import { Plug, FileText } from "./icons.jsx";

import openclaw from "./assets/openclaw.svg";
import hermes from "./assets/hermes.png";
import ollama from "./assets/ollama.png";
import lmstudio from "./assets/lmstudio.png";
import claude from "./assets/claude-code.svg";

const brands = {
  github,
  openclaw, hermes, ollama, lmstudio, "claw-code": claude, "claude-code": claude,
  hero, labelwin, plancraft, tooltime, openhandwerk, pds, 'streitv.1':streit,
  winworker, weclapp, centralstationcrm, casgenesisworld:cas, cobracrm:cobra, sapbusinessone:sap,
  a2a,
  codex:openai,
  groq,
  gmail,
  outlook,
  whatsapp,
  higgsfield,
  "21st.dev": twentyFirst,
  elevenlabs,
  n8n,

  telegram,
  discord,
  openaibilder:openai,
  whatsappbusiness:whatsapp,
};
export function BrandIcon({ name, fallback: Fallback = Plug }) {
  const key = name?.toLowerCase().replace(/\s+/g, "");
  const src = brands[key];
  const needsBrandSurface = ['github','hero','labelwin','openhandwerk','centralstationcrm','cobracrm'].includes(key);
  return (
    <div className={"app-icon " + (src ? "brand-icon brand-" + key : "") + (needsBrandSurface ? ' brand-asset-surface' : '')}>
      {src ? (
        <img src={src} alt="" width="36" height="36" />
      ) : (
        <Fallback size={24} />
      )}
    </div>
  );
}
export function SkillIcon({ skill }) {
  return (
    <div className="app-icon skill-art">
      <img src={skillArt(skill)} alt="" width="44" height="44" loading="lazy" />
    </div>
  );
}
export const skillName = (s) =>
  s.interface?.displayName ||
  s.name
    .split(":")
    .at(-1)
    .split("-")
    .map((p) =>
      ["ui", "ux", "hig", "ai", "pdf"].includes(p)
        ? p.toUpperCase()
        : p[0].toUpperCase() + p.slice(1),
    )
    .join(" ");
export const skillDescription = (s) =>
  s.interface?.shortDescription ||
  s.description?.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ||
  s.description;
