export const VIRUS_SCANNER_PORT = Symbol('VIRUS_SCANNER_PORT');

export type VirusScanVerdict = 'clean' | 'infected';

export interface VirusScannerPort {
  scanStream(stream: NodeJS.ReadableStream): Promise<VirusScanVerdict>;
}
