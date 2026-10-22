/** Bump when the copy changes enough that viewers should see the tour again. */
export const TOUR_VERSION = 1;
export const TOUR_ID = 'first-run';
const anchor = (name, fallback) => ({ selector: `[data-playwell="${name}"]`, source: 'stable-anchor', ...(fallback ? { fallback } : {}) });
const para = (...texts) => texts.map((text, i) => ({ type: 'paragraph', id: `p${i + 1}`, text }));
export function firstRunFlow(config, command, empty) {
    const when = config.schedule ? `, or let it run on your schedule (${config.schedule})` : '';
    return {
        id: TOUR_ID,
        version: TOUR_VERSION,
        name: 'Welcome to Rundown',
        steps: [
            {
                id: 'welcome',
                title: config.owner ? `Welcome, ${config.owner.split(/\s+/)[0]}` : 'Welcome to Rundown',
                blocks: para('Rundown is one board for everything you have in flight. It fills itself from check-ins, so you never type status in by hand.', 'This takes about 30 seconds, and you can skip it any time.'),
            },
            {
                id: 'checkin',
                title: 'Check-ins fill the board',
                target: anchor('checkin'),
                missingTarget: 'skip',
                blocks: para(`Run ${command} in Claude${when}. Each check-in reads your work and updates the rows: where you left off, the next step, and what's blocked.`, 'This button copies the command for you.'),
            },
            {
                id: 'stats',
                title: 'What needs you',
                target: anchor('stats'),
                missingTarget: 'skip',
                blocks: para(empty
                    ? 'Once rows land, these counts show what needs you, open decisions, what you are waiting on, and what has gone stale. Each one filters the list.'
                    : 'These counts show what needs you, open decisions, what you are waiting on, and what has gone stale. Each one filters the list.'),
            },
            {
                id: 'ask',
                title: 'Ask Rundown',
                target: anchor('ask', '[data-playwell="ask-box"]'),
                missingTarget: 'skip',
                blocks: para('Ask about your projects in plain words, like "what is blocked this week?" Save the answers you want to keep.'),
            },
            {
                id: 'settings',
                title: 'Your settings and locker',
                target: anchor('settings'),
                missingTarget: 'skip',
                blocks: para('Color mode, the Locker (dismissed notes for 14 days, saved answers until you remove them), feedback links, and Take the tour to replay this.'),
            },
        ],
    };
}
