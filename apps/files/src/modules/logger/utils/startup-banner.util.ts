export type FilesStartupBannerParams = {
  env: string;
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

/**
 * Баннер в сыром stdout: без Winston (без timestamp/JSON) и без Nest-обёртки.
 * Стиль совпадает с snapflow-core (`startup-banner.util.ts`); данные — TCP-микросервис files.
 * Swagger отсутствует — строка swagger в баннер не выводится.
 *
 * Логотип: монограмма **FL** (Files).
 */
export function printFilesStartupBannerToConsole(params: FilesStartupBannerParams): void {
  const { env, port, startedAt } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const cyan = '\x1b[36m';
  const mag = '\x1b[35m';
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
  const flMark = [
    ' ███████╗ ██╗      ',
    ' ██╔════╝ ██║      ',
    ' █████╗   ██║      ',
    ' ██╔══╝   ██║      ',
    ' ██║      ███████╗ ',
    ' ╚═╝      ╚══════╝ ',
  ];

  const title = `${bold}${mag}SNAPFLOW${r} ${dim}·${r} ${bold}${mag}FILES${r}`;

  const lines: string[] = [
    '',
    motdLine(`${cyan}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...flMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${mag}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${cyan}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}environment${r}${dim}:${r}   ${ylw}${env}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}listen${r}${dim}:${r}        ${ylw}${String(port)}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}started at${r}${dim}:${r}    ${ylw}${startedAt}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${cyan}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    console.log(line);
  }
}
