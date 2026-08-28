import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection } from 'node:net';
import { Readable } from 'node:stream';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ClamAvSettings } from '../../../../setup/configuration/clam-av-settings';
import { VirusScannerPort, VirusScanVerdict } from './virus-scanner.port';

const INSTREAM_COMMAND = 'nINSTREAM\n';

@Injectable()
export class ClamAvScannerAdapter implements VirusScannerPort {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService<Configuration, true>) {
    const settings = configService.get<ClamAvSettings>('clamAvSettings');
    this.host = settings.host;
    this.port = settings.port;
    this.timeoutMs = settings.timeoutMs;
  }

  async scanStream(stream: NodeJS.ReadableStream): Promise<VirusScanVerdict> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const payload = Buffer.concat(chunks);
    const response = await this.scanBuffer(payload);

    if (response.includes('FOUND')) {
      return 'infected';
    }

    if (response.includes('OK')) {
      return 'clean';
    }

    throw new Error(`Unexpected ClamAV response: ${response}`);
  }

  private scanBuffer(payload: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('ClamAV scan timed out'));
      }, this.timeoutMs);

      let response = '';

      socket.on('data', (data: Buffer) => {
        response += data.toString('utf8');
      });

      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      socket.on('close', () => {
        clearTimeout(timer);
        resolve(response);
      });

      socket.write(INSTREAM_COMMAND);

      let offset = 0;

      while (offset < payload.length) {
        const chunkSize = Math.min(payload.length - offset, 2048);
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(chunkSize, 0);
        socket.write(sizeBuffer);
        socket.write(payload.subarray(offset, offset + chunkSize));
        offset += chunkSize;
      }

      socket.write(Buffer.alloc(4));
      socket.end();
    });
  }
}

@Injectable()
export class NoopScannerAdapter implements VirusScannerPort {
  scanStream(_stream: NodeJS.ReadableStream): Promise<VirusScanVerdict> {
    if (_stream instanceof Readable) {
      _stream.resume();
    }

    return Promise.resolve('clean');
  }
}
