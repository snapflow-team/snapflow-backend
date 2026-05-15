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
 * Стартовый баннер в stdout (без Winston), в духе snapflow-core: монограмма **PAY** (Payments).
 */
export function printPaymentsStartupBannerToConsole(params: PaymentsStartupBannerParams): void {
  const { env, port, swaggerDocUrl, startedAt, showSwagger } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const cyan = '\x1b[36m';
  /** Акцент (монограмма, заголовок, ▸): спокойный серо-синий / slate (256). */
  const acc = '\x1b[38;5;109m';
  const ylw = '\x1b[33m';

  const W = 62;
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);
    return `${cyan}│${r}${content}${' '.repeat(pad)}${cyan}│${r}`;
  };

  const hrPlain = '─'.repeat(W);
  /** ANSI Shadow PAY: `█` + box-drawing, тенью; все строки одинаковой длины через normalizeMonogramRows. */
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
    motdLine(`${cyan}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...payMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${acc}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${cyan}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}environment${r}${dim}:${r}   ${ylw}${env}${r}`)),
    motdLine(
      boxRow(`  ${acc}▸${r}  ${bold}listen${r}${dim}:${r}        ${ylw}${String(port)}${r}`),
    ),
    ...(showSwagger
      ? [
          motdLine(
            boxRow(`  ${acc}▸${r}  ${bold}swagger${r}${dim}:${r}       ${ylw}${swaggerDocUrl}${r}`),
          ),
        ]
      : []),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}started at${r}${dim}:${r}    ${ylw}${startedAt}${r}`)),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${cyan}╰${hrPlain}╯${r}`),
    '',
  ];

  for (const line of lines) {
    // eslint-disable-next-line no-console -- намеренный баннер в TTY
    console.log(line);
  }
}
