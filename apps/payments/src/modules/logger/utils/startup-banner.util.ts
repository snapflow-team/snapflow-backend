export type PaymentsStartupBannerParams = {
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

/** Одна визуальная ширина строк баннера — иначе центрирование «плывёт» по рядам. */
function normalizeMonogramRows(rows: readonly string[]): string[] {
  const trimmed = rows.map((row) => row.trimEnd());
  const maxLen = Math.max(0, ...trimmed.map((row) => row.length));

  return trimmed.map((row) => row.padEnd(maxLen, ' '));
}

/**
 * Баннер в сыром stdout: без Winston (без timestamp/JSON) и без Nest-обёртки.
 * Стиль совпадает с snapflow-core (`startup-banner.util.ts`).
 *
 * Логотип: монограмма **PAY** (Payments).
 */
export function printPaymentsStartupBannerToConsole(params: PaymentsStartupBannerParams): void {
  const { env, port, swaggerDocUrl, startedAt, showSwagger } = params;
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
  /** ANSI Shadow PAY: `█` + box-drawing; все строки одинаковой длины через normalizeMonogramRows. */
  const payMark = normalizeMonogramRows([
    '██████╗  █████╗ ██╗   ██╗',
    '██╔══██╗██╔══██╗╚██╗ ██╔╝',
    '██████╔╝███████║ ╚████╔╝ ',
    '██╔═══╝ ██╔══██║  ╚██╔╝  ',
    '██║     ██║  ██║   ██║   ',
    '╚═╝     ╚═╝  ╚═╝   ╚═╝   ',
  ]);

  const title = `${bold}${mag}SNAPFLOW${r} ${dim}·${r} ${bold}${mag}PAYMENTS${r}`;
  const lines: string[] = [
    '',
    motdLine(`${cyan}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...payMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${mag}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${cyan}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}environment${r}${dim}:${r}   ${ylw}${env}${r}`)),
    motdLine(
      boxRow(`  ${grn}▸${r}  ${bold}listen${r}${dim}:${r}        ${ylw}${String(port)}${r}`),
    ),
    ...(showSwagger
      ? [
          motdLine(
            boxRow(`  ${grn}▸${r}  ${bold}swagger${r}${dim}:${r}       ${ylw}${swaggerDocUrl}${r}`),
          ),
        ]
      : []),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}started at${r}${dim}:${r}    ${ylw}${startedAt}${r}`)),
    motdLine(boxRow(`  ${grn}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${cyan}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    console.log(line);
  }
}
