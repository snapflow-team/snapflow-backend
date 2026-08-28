import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { Configuration } from '../../../../setup/configuration/configuration';
import { MediaProcessingSettings } from '../../../../setup/configuration/media-processing-settings';
import { AudioProbeResult, AvProcessorPort, VideoProbeResult } from './media-processor.port';

@Injectable()
export class FfmpegAvProcessorAdapter implements AvProcessorPort {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;

  constructor(configService: ConfigService<Configuration, true>) {
    const settings = configService.get<MediaProcessingSettings>('mediaProcessingSettings');
    this.ffmpegPath = settings.ffmpegPath;
    this.ffprobePath = settings.ffprobePath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await access(this.ffmpegPath, constants.X_OK);
      await access(this.ffprobePath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  async probeVideo(inputPath: string): Promise<VideoProbeResult> {
    const output = await this.runProcess(this.ffprobePath, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,width,height',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      inputPath,
    ]);

    const parsed = JSON.parse(output) as {
      streams?: Array<{ codec_name?: string; width?: number; height?: number }>;
      format?: { duration?: string };
    };

    const stream = parsed.streams?.[0];
    const durationSec = Number(parsed.format?.duration ?? 0);

    return {
      durationMs: Math.round(durationSec * 1000),
      width: stream?.width ?? 0,
      height: stream?.height ?? 0,
      codec: stream?.codec_name ?? 'unknown',
    };
  }

  async probeAudio(inputPath: string): Promise<AudioProbeResult> {
    const output = await this.runProcess(this.ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      inputPath,
    ]);

    const parsed = JSON.parse(output) as { format?: { duration?: string } };
    const durationSec = Number(parsed.format?.duration ?? 0);

    return { durationMs: Math.round(durationSec * 1000) };
  }

  async transcodeVideoPreview(inputPath: string, outputPath: string): Promise<void> {
    await this.runProcess(this.ffmpegPath, [
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=-2:720',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-movflags',
      '+faststart',
      '-an',
      outputPath,
    ]);
  }

  async extractPosterFrame(inputPath: string, outputPath: string): Promise<void> {
    await this.runProcess(this.ffmpegPath, [
      '-y',
      '-ss',
      '00:00:01',
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      outputPath,
    ]);
  }

  async extractWaveform(inputPath: string, sampleCount: number): Promise<number[]> {
    const output = await this.runProcess(
      this.ffmpegPath,
      ['-i', inputPath, '-ac', '1', '-filter:a', `aresample=${sampleCount}`, '-f', 'f32le', '-'],
      true,
    );

    const buffer = Buffer.from(output, 'binary');
    const samples: number[] = [];

    for (let i = 0; i < buffer.length; i += 4) {
      samples.push(buffer.readFloatLE(i));
    }

    const max = Math.max(...samples.map(Math.abs), 1);

    return samples.map((value) => Number((Math.abs(value) / max).toFixed(4)));
  }

  private runProcess(command: string, args: string[], binaryOutput = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `${command} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8')}`,
            ),
          );
          return;
        }

        const result = Buffer.concat(stdout);

        resolve(binaryOutput ? result.toString('binary') : result.toString('utf8'));
      });
    });
  }
}
