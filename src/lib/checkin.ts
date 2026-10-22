/**
 * The header check-in button. Where a Claude chat sits beside the board, a click hands that chat a
 * check-in request (the platform asks the viewer before it sends); anywhere else it copies the command.
 */
import type { ArtifactRoom, SendAvailability, ToClaude } from '../types.js';
import { store } from '../store.js';
import { copyCommand, flashLabel } from './dom.js';

const COMMAND = '/project-checkin';
const BOARD = 'https://claude.ai/artifact/9SKAeDw2oHGRHzvB14vQ8L';
const SENDS: ReadonlySet<SendAvailability> = new Set(['available', 'available_if_summoned', 'available_if_opened']);

let room: ArtifactRoom | null = null;
let can: SendAvailability = 'off';

/** Platform bounds refuse invisible format characters in sent strings. */
const clean = (s: string): string => s.replace(/\p{Cf}/gu, '').slice(0, 200);

/** What the chat receives: the command, the expanded project (if any), and how to run it from here. */
export function checkinRequest(): ToClaude {
  const { openId, projects } = store.state;
  const p = projects.find((x) => x.id === openId);
  return {
    label: p ? clean(`Check in: ${p.name}`) : 'Project check-in',
    command: COMMAND,
    board: BOARD,
    project: p ? { id: p.id, name: clean(p.name) } : null,
    note: 'The viewer pressed the check-in button on their Rundown board. Run the project-checkin skill for `project`, '
      + 'or ask which project when it is null. This chat is outside that Project, so its chat history is not searchable here: '
      + 'build the check-in from the board row, memory, recent chats and repos, and say which sources you could not reach. '
      + 'Show the status and wait for the viewer to confirm before writing the row.',
  };
}

function describe(btn: HTMLButtonElement): void {
  const sends = SENDS.has(can);
  btn.title = sends ? 'Run /project-checkin in the chat beside the board' : 'Copy /project-checkin';
  btn.setAttribute('aria-label', sends ? 'Run /project-checkin in chat' : 'Copy /project-checkin command');
}

async function refresh(btn: HTMLButtonElement): Promise<void> {
  if (!room) return;
  try { can = await room.canSendToClaudeSession(); } catch { can = 'off'; }
  describe(btn);
}

/** Wires the button. The send runs synchronously in the click so the platform can prove the gesture. */
export function initCheckin(btn: HTMLButtonElement): void {
  const label = btn.querySelector('.cta-lbl');
  if (!label) return;
  const idle = label.textContent ?? COMMAND;
  btn.addEventListener('click', () => {
    if (!room || !SENDS.has(can)) { void copyCommand(label, idle, COMMAND); return; }
    const deliver = can === 'available_if_opened' ? 'stage' : 'send';
    room.sendToClaudeSession(checkinRequest(), { deliver, attachPresence: false })
      .then(() => flashLabel(label, deliver === 'send' ? 'Sent to chat' : 'In your chat', idle))
      .catch(() => { void copyCommand(label, idle, COMMAND); void refresh(btn); });
  });
  for (const ev of ['pointerenter', 'focus'] as const) btn.addEventListener(ev, () => void refresh(btn));
  window.addEventListener('focus', () => void refresh(btn));
  const claude = window.claude;
  if (!claude) return;
  void claude.use('room').then((r) => { room = r; return refresh(btn); }, () => undefined);
}
