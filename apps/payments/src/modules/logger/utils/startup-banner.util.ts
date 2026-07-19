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
  const frame = '\x1b[38;5;174m'; // мягкий персиковый
  const acc = '\x1b[38;5;174m';
  const val = '\x1b[38;5;223m'; // мягкий кремовый

  const W = 62;
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);
    return `${frame}│${r}${content}${' '.repeat(pad)}${frame}│${r}`;
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

  const title = `${bold}${acc}SNAPFLOW${r} ${dim}·${r} ${bold}${acc}PAYMENTS${r}`;
  const lines: string[] = [
    '',
    motdLine(`${frame}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...payMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${acc}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${frame}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}environment${r}${dim}:${r}   ${val}${env}${r}`)),
    motdLine(
      boxRow(`  ${acc}▸${r}  ${bold}listen${r}${dim}:${r}        ${val}${String(port)}${r}`),
    ),
    ...(showSwagger
      ? [
          motdLine(
            boxRow(`  ${acc}▸${r}  ${bold}swagger${r}${dim}:${r}       ${val}${swaggerDocUrl}${r}`),
          ),
        ]
      : []),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}started at${r}${dim}:${r}    ${val}${startedAt}${r}`)),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${frame}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    console.log(line);
  }
}
