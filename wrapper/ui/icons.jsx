import React from "react";
import { MotionGlyph } from "./motion-glyph";
// Public names and sizes stay stable; all shapes and motion come from the shared catalog.
const wrap = (name, extraClass = "") =>
  function Icon({ size = 18, strokeWidth = 1.55, className = "", ...props }) {
    return (
      <MotionGlyph
        {...props}
        name={name}
        size={size}
        strokeWidth={strokeWidth}
        className={extraClass + " " + className}
      />
    );
  };
export const PanelLeft = wrap("PanelLeft");
export const PanelRight = wrap("PanelRight");
export const Maximize = wrap("Maximize");
export const Minimize = wrap("Minimize");
export const ChevronDown = wrap("ChevronDown");
export const ChevronRight = wrap("ChevronRight");
export const ChevronLeft = wrap("ChevronLeft");
export const ArrowLeft = wrap("ArrowLeft");
export const ArrowUp = wrap("ArrowUp");
export const ArrowUpRight = wrap("ArrowUpRight");
export const Plus = wrap("Plus");
export const Search = wrap("Search");
export const Bell = wrap("Bell");
export const Settings = wrap("Settings");
export const SquarePen = wrap("SquarePen");
export const Clock = wrap("Clock");
export const Plug = wrap("Plug");
export const Folder = wrap("Folder");
export const FolderOpen = wrap("FolderOpen");
export const FileText = wrap("FileText");
export const Terminal = wrap("Terminal");
export const Globe = wrap("Globe");
export const GitBranch = wrap("GitBranch");
export const MoreHorizontal = wrap("MoreHorizontal");
export const Command = wrap("Command");
export const Shield = wrap("Shield");
export const ShieldCheck = wrap("ShieldCheck");
export const KeyRound = wrap("KeyRound");
export const Sun = wrap("Sun");
export const Moon = wrap("Moon");
export const Mic = wrap("Mic");
export const Square = wrap("Square");
export const Copy = wrap("Copy");
export const Check = wrap("Check");
export const X = wrap("X");
export const LoaderCircle = wrap("LoaderCircle", "ui-icon-spinner");
export const Pin = wrap("Pin");
export const Archive = wrap("Archive");
export const RotateCcw = wrap("RotateCcw");
export const Download = wrap("Download");
export const Wrench = wrap("Wrench");
export const Play = wrap("Play");
export const Pause = wrap("Pause");
export const Workflow = wrap("Workflow");
export const Blocks = wrap("Blocks");
export const Link = wrap("Link");
export const ExternalLink = wrap("ExternalLink");
export const BrainCircuit = wrap("BrainCircuit");
export const Paperclip = wrap("Paperclip");
export const Send = wrap("Send");
export const SlidersHorizontal = wrap("SlidersHorizontal");
export const Ellipsis = wrap("Ellipsis");
export const Activity = wrap("Activity");
export const User = wrap("User");
export const Trash2 = wrap("Trash2");
export const RefreshCw = wrap("RefreshCw");
export const Keyboard = wrap("Keyboard");
export const Image = wrap("Image");
export const Volume2 = wrap("Volume2");
export const Inbox = wrap("Inbox");
export const Mail = wrap("Mail");
export const Calendar = wrap("Calendar");
export const MessageCircle = wrap("MessageCircle");
export const Braces = wrap("Braces");
export const Sparkles = wrap("Sparkles");
export const CheckCircle2 = wrap("CheckCircle2");
export const AlertCircle = wrap("AlertCircle");
export const LogIn = wrap("LogIn");
export const HardDrive = wrap("HardDrive");
export const Lock = wrap("Lock");
export const PhoneOff = wrap("PhoneOff");
export const AudioLines = wrap("AudioLines");
export const Briefcase = wrap("Briefcase");
export const Zap = wrap("Zap");
