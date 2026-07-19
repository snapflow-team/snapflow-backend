export type StartupBannerParams = {
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
 * New Relic при `application_logging` подхватит `console` отдельно, если агент это пересылает.
 *
 * Логотип: монограмма **SF** (Snapflow).
 */
export function printSnapflowStartupBannerToConsole(params: StartupBannerParams): void {
  const { env, port, swaggerDocUrl, startedAt, showSwagger } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const frame = '\x1b[38;5;73m'; // мягкий бирюзовый
  const acc = '\x1b[38;5;141m'; // мягкая лаванда
  const mark = '\x1b[38;5;108m'; // мягкий шалфей
  const val = '\x1b[38;5;187m'; // мягкий пшеничный

  const W = 62;
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);
    return `${frame}│${r}${content}${' '.repeat(pad)}${frame}│${r}`;
  };

  const hrPlain = '─'.repeat(W);
  const sfMark = [
    ' ███████╗ ███████╗ ',
    ' ██╔════╝ ██╔════╝ ',
    ' ███████╗ █████╗   ',
    ' ╚════██║ ██╔══╝   ',
    ' ███████║ ██║      ',
    ' ╚══════╝ ╚═╝      ',
  ];

  const title = `${bold}${acc}SNAPFLOW${r} ${dim}·${r} ${bold}${acc}CORE${r}`;
  const lines: string[] = [
    '',
    motdLine(`${frame}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...sfMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${acc}${row}${r}`, W)))),
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
