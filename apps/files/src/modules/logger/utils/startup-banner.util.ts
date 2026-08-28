export type FilesStartupBannerParams = {
  env: string;
  mode: 'rpc' | 'ingest' | 'worker' | 'all-in-one';
  startedAt: string;
  rpcPort?: number;
  httpPort?: number;
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

function formatMode(mode: FilesStartupBannerParams['mode']): string {
  switch (mode) {
    case 'rpc':
      return 'rpc';
    case 'ingest':
      return 'ingest';
    case 'worker':
      return 'worker';
    case 'all-in-one':
      return 'all-in-one';
  }
}

/**
 * Баннер в сыром stdout: без Winston (без timestamp/JSON) и без Nest-обёртки.
 * Стиль совпадает с snapflow-core (`startup-banner.util.ts`); данные — TCP-микросервис files.
 * Swagger отсутствует — строка swagger в баннер не выводится.
 *
 * Логотип: монограмма **FL** (Files).
 */
export function printFilesStartupBannerToConsole(params: FilesStartupBannerParams): void {
  const { env, mode, startedAt, rpcPort, httpPort } = params;
  const pid = process.pid;
  const r = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const frame = '\x1b[38;5;108m'; // мягкий шалфей
  const acc = '\x1b[38;5;179m'; // мягкий песочный
  const val = '\x1b[38;5;180m'; // мягкий бежевый

  const W = 62;
  const MOTD_COLS = 80;
  const motdLine = (s: string): string => centerVisual(s, MOTD_COLS);

  const boxRow = (content: string): string => {
    const pad = Math.max(0, W - stripAnsi(content).length);
    return `${frame}│${r}${content}${' '.repeat(pad)}${frame}│${r}`;
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

  const title = `${bold}${acc}SNAPFLOW${r} ${dim}·${r} ${bold}${acc}FILES${r}`;

  const lines: string[] = [
    '',
    motdLine(`${frame}╭${hrPlain}╮${r}`),
    motdLine(boxRow('')),
    ...flMark.map((row) => motdLine(boxRow(centerVisual(`${bold}${acc}${row}${r}`, W)))),
    motdLine(boxRow('')),
    motdLine(boxRow(centerVisual(title, W))),
    motdLine(boxRow('')),
    motdLine(`${frame}├${hrPlain}┤${r}`),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}environment${r}${dim}:${r}   ${val}${env}${r}`)),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}mode${r}${dim}:${r}          ${val}${formatMode(mode)}${r}`)),
  ];

  if (rpcPort !== undefined) {
    lines.push(
      motdLine(boxRow(`  ${acc}▸${r}  ${bold}rpc listen${r}${dim}:${r}    ${val}${String(rpcPort)}${r}`)),
    );
  }

  if (httpPort !== undefined) {
    lines.push(
      motdLine(
        boxRow(`  ${acc}▸${r}  ${bold}http listen${r}${dim}:${r}   ${val}${String(httpPort)}${r}`),
      ),
    );
  }

  lines.push(
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}started at${r}${dim}:${r}    ${val}${startedAt}${r}`)),
    motdLine(boxRow(`  ${acc}▸${r}  ${bold}pid${r}${dim}:${r}           ${dim}${pid}${r}`)),
    motdLine(`${frame}╰${hrPlain}╯${r}`),
    '',
  );

  for (const line of lines) {
    console.log(line);
  }
}
