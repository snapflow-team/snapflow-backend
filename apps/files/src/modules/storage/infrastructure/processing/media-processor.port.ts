export const IMAGE_PROCESSOR_PORT = Symbol('IMAGE_PROCESSOR_PORT');
export const AV_PROCESSOR_PORT = Symbol('AV_PROCESSOR_PORT');

export interface ProcessedImageVariant {
  buffer: Buffer;
  mimeType: string;
  byteSize: bigint;
  width: number;
  height: number;
}

export interface ImageProcessingResult {
  original: ProcessedImageVariant;
  thumb: ProcessedImageVariant;
  preview: ProcessedImageVariant;
  blurhash: string;
}

export interface ImageProcessorPort {
  processImage(input: Buffer): Promise<ImageProcessingResult>;
}

export interface VideoProbeResult {
  durationMs: number;
  width: number;
  height: number;
  codec: string;
}

export interface AudioProbeResult {
  durationMs: number;
}

export interface AvProcessingResult {
  previewBuffer: Buffer;
  previewMimeType: string;
  previewByteSize: bigint;
  previewWidth: number;
  previewHeight: number;
  posterBuffer: Buffer;
  posterMimeType: string;
  posterByteSize: bigint;
  durationMs: number;
}

export interface VoiceProcessingResult {
  durationMs: number;
  waveform: number[];
}

export interface AvProcessorPort {
  probeVideo(inputPath: string): Promise<VideoProbeResult>;
  probeAudio(inputPath: string): Promise<AudioProbeResult>;
  transcodeVideoPreview(inputPath: string, outputPath: string): Promise<void>;
  extractPosterFrame(inputPath: string, outputPath: string): Promise<void>;
  extractWaveform(inputPath: string, sampleCount: number): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}
