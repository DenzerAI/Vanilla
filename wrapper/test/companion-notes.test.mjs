import test from "node:test";
import assert from "node:assert/strict";
import { addNote, activeNotes, dismissNote, dropChatNotes, noteText, NOTE_MS, NOTE_LIMIT } from "../ui/companion-notes.mjs";

test("Meldungen werden je Chat und Art nur einmal geführt, laufen ab und lassen sich schließen", () => {
  let notes = addNote([], { kind: "done", chatId: "a" }, 1000);
  notes = addNote(notes, { kind: "done", chatId: "a" }, 2000);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].at, 2000);
  notes = addNote(notes, { kind: "approval", chatId: "a" }, 3000);
  assert.equal(notes.length, 2);
  assert.equal(activeNotes(notes, 3000 + NOTE_MS - 1).length, 1);
  assert.equal(activeNotes(notes, 3000 + NOTE_MS).length, 0);
  notes = dismissNote(notes, notes[1].id);
  assert.equal(activeNotes(notes, 4000).length, 1);
  assert.equal(dropChatNotes(notes, "a").length, 0);
  assert.equal(dropChatNotes(notes, "a", ["approval"]).length, 1);
  for (let i = 0; i < NOTE_LIMIT + 3; i++) notes = addNote(notes, { kind: "job", noticeId: String(i), title: "Job" }, 5000 + i);
  assert.equal(notes.length, NOTE_LIMIT);
});

test("die Blase spricht in Fakten", () => {
  assert.equal(noteText({ kind: "done", chatId: "a" }, "Vanillaordner finden"), "Vanillaordner finden ist fertig");
  assert.equal(noteText({ kind: "approval", chatId: "a" }, "Instagram-Lauf"), "Instagram-Lauf braucht eine Freigabe");
  assert.equal(noteText({ kind: "failed", chatId: "a" }, ""), "Ein anderer Chat ist fehlgeschlagen");
  assert.equal(noteText({ kind: "job", noticeId: "1", title: "Tagesüberblick" }), "Tagesüberblick ist fertig");
});
