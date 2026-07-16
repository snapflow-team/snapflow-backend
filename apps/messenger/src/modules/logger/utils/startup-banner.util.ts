export type MessengerStartupBannerParams = {
  env: string;
  port: number;
  swaggerDocUrl: string;
  startedAt: string;
  showSwagger: boolean;
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

/**
 * Баннер в сыром stdout: без Winston (без timestamp/JSON) и без Nest-обёртки.
 * Стиль совпадает с snapflow-core (`startup-banner.util.ts`).
 *
 * Логотип: монограмма **MS** (Messenger).
 */
export function printMessengerStartupBannerToConsole(params: MessengerStartupBannerParams): void {
  const { env, port, swaggerDocUrl, startedAt, showSwagger } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const frame = '\x1b[38;5;111m'; // мягкий стальной синий
  const acc = '\x1b[38;5;117m'; // мягкий небесный
  const mark = '\x1b[38;5;111m';
  const val = '\x1b[38;5;153m'; // мягкий мятный

  const W = 62;
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);
    return `${frame}│${r}${content}${' '.repeat(pad)}${frame}│${r}`;
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

  const title = `${bold}${acc}SNAPFLOW${r} ${dim}·${r} ${bold}${acc}MESSENGER${r}`;
  const lines: string[] = [
    '',
    motdLine(`${frame}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...msMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${acc}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${frame}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${mark}▸${r}  ${bold}environment${r}${dim}:${r}   ${val}${env}${r}`)),
    motdLine(
      boxRow(`  ${mark}▸${r}  ${bold}listen${r}${dim}:${r}        ${val}${String(port)}${r}`),
    ),
    ...(showSwagger
      ? [
          motdLine(
            boxRow(`  ${mark}▸${r}  ${bold}swagger${r}${dim}:${r}       ${val}${swaggerDocUrl}${r}`),
          ),
        ]
      : []),
    motdLine(boxRow(`  ${mark}▸${r}  ${bold}started at${r}${dim}:${r}    ${val}${startedAt}${r}`)),
    motdLine(boxRow(`  ${mark}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${frame}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    console.log(line);
  }
}
