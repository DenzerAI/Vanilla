import test from "node:test";
import assert from "node:assert/strict";
import {
  visiblePanes,
  selectPaneCount,
  conversationText,
} from "../ui/chat-layout.mjs";
import { createEventSubscription } from "../ui/chat-events.mjs";

test("responsive layout keeps the active chat reachable without dropping pane identities", () => {
  const order = [0, 1, 2, 3];
  for (const width of [0, 320, 390, 400, 805, 806, 1200, 1212, 1618, 2400]) {
    for (const active of order) {
      const visible = visiblePanes(order, active, width);
      assert.ok(visible.includes(active), `active ${active} at ${width}`);
      assert.ok(visible.length >= 1 && visible.length <= 4);
      if (visible.length > 1)
        assert.ok(visible.length * 400 + (visible.length - 1) * 6 <= width);
      assert.deepEqual(order, [0, 1, 2, 3]);
      assert.deepEqual(visiblePanes(order, active, width, true), [active]);
    }
  }
  assert.deepEqual(visiblePanes(order, 3, 1618), order);
});
test("turning multi-chat off keeps the selected panel and re-enabling restores positions", () => {
  for (const active of [0, 1, 2, 3]) {
    const single = selectPaneCount([0, 1, 2, 3], active, 1);
    assert.deepEqual(single, [active]);
    assert.deepEqual(selectPaneCount(single, active, 4), [0, 1, 2, 3]);
    for (const count of [2, 3]) {
      const next = selectPaneCount([0, 1, 2, 3], active, count);
      assert.equal(next.length, count);
      assert.equal(new Set(next).size, count);
      assert.ok(next.includes(active));
    }
  }
});
test("sharing exports conversation text and attachments without tool output or reasoning", () => {
  const text = conversationText(
    {
      turns: [
        {
          items: [
            {
              type: "userMessage",
              content: [
                { type: "text", text: "Hallo" },
                { type: "localImage", path: "/private/input/photo.png" },
              ],
            },
            { type: "commandExecution", aggregatedOutput: "tool-secret" },
            { type: "reasoning", text: "private-reasoning" },
            { type: "agentMessage", text: "Antwort mit **Formatierung**" },
          ],
        },
      ],
    },
    "Mein Titel",
  );
  assert.match(text, /# Mein Titel/);
  assert.match(text, /Hallo\n\[Anhang: photo.png\]/);
  assert.match(text, /Antwort mit \*\*Formatierung\*\*/);
  assert.doesNotMatch(text, /tool-secret|private-reasoning|\/private/);
});
test("all panels share one event stream, receive live updates and unsubscribe independently", async () => {
  const previous = globalThis.EventSource,
    made = [];
  globalThis.EventSource = class extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 0;
      this.closed = false;
      made.push(this);
    }
    close() {
      this.closed = true;
    }
  };
  const subscriptions = [];
  try {
    const received = Array.from({ length: 4 }, () => []);
    for (let i = 0; i < 4; i++) {
      const sub = createEventSubscription();
      sub.onmessage = (e) => received[i].push(JSON.parse(e.data));
      subscriptions.push(sub);
    }
    assert.equal(made.length, 1);
    made[0].dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          method: "item/agentMessage/delta",
          params: { threadId: "chat-a", delta: "Hello" },
        }),
      }),
    );
    assert.ok(received.every((events) => events[0].params.delta === "Hello"));
    subscriptions[1].close();
    made[0].dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          method: "turn/completed",
          params: { threadId: "chat-b" },
        }),
      }),
    );
    assert.equal(received[1].length, 1);
    assert.equal(received[3].length, 2);
    assert.equal(made[0].closed, false);
    made[0].readyState = 1;
    const late = createEventSubscription();
    subscriptions.push(late);
    let opened = false;
    late.onopen = () => {
      opened = true;
    };
    await Promise.resolve();
    assert.equal(opened, true);
    subscriptions.forEach((s) => s.close());
    assert.equal(made[0].closed, true);
  } finally {
    subscriptions.forEach((s) => s.close());
    globalThis.EventSource = previous;
  }
});

 test('shared starfield follows visible welcome states and preserves off/all modes', async () => {
  const {sharedParticlesEnabled} = await import('../ui/chat-layout.mjs');
  assert.equal(sharedParticlesEnabled('off', [{welcome:true}]), false);
  assert.equal(sharedParticlesEnabled('all', [{welcome:false}]), true);
  assert.equal(sharedParticlesEnabled('on', [{welcome:false}, {welcome:true}]), true);
  assert.equal(sharedParticlesEnabled('on', [{welcome:false}, null]), false);
  assert.equal(sharedParticlesEnabled(undefined, [{welcome:true}]), true);
 });
