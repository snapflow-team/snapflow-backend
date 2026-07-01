export type MessengerStartupBannerParams = {
  env: string;
  baseUrl: string;
  port: number;
  startedAt: string;
};

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function centerVisual(text: string, width: number): string {
  const visible = stripAnsi(text);
  const pad = Math.max(0, width - visible.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;

  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

export function printMessengerStartupBannerToConsole(params: MessengerStartupBannerParams): void {
  const { env, baseUrl, port, startedAt } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const cyan = '\x1b[36m';
  const blu = '\x1b[34m';
  const grn = '\x1b[32m';
  const ylw = '\x1b[33m';

  const W = 62;
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);
    return `${cyan}│${r}${content}${' '.repeat(pad)}${cyan}│${r}`;
  };

  const hrPlain = '─'.repeat(W);
  const msMark = [
    ' ███╗   ███╗ ███████╗ ',
    ' ████╗ ████║ ██╔════╝ ',
    ' ██╔████╔██║ ███████╗ ',
    ' ██║╚██╔╝██║ ╚════██║ ',
    ' ██║ ╚═╝ ██║ ███████║ ',
    ' ╚═╝     ╚═╝ ╚══════╝ ',
  ];

  const title = `${bold}${blu}SNAPFLOW${r} ${dim}·${r} ${bold}${blu}MESSENGER${r}`;
  const listenAddr = `${baseUrl}:${String(port)}`;

  const lines: string[] = [
    '',
    motdLine(`${cyan}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...msMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${blu}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${cyan}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}environment${r}${dim}:${r}   ${ylw}${env}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}listen${r}${dim}:${r}        ${ylw}${listenAddr}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}started at${r}${dim}:${r}    ${ylw}${startedAt}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${cyan}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    console.log(line);
  }
}
