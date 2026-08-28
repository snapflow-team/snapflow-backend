import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import type { StorageObjectStatus } from '@contracts/storage';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ExtractUserFromRequest } from '../auth/decorators/extract-user-from-request.decorator';
import type { UserContextDto } from '../auth/dto/user-context.dto';
import {
  AbortResumableUploadUseCase,
  CompleteResumableUploadUseCase,
  CreateResumableUploadUseCase,
  DirectUploadUseCase,
  GetUploadSessionUseCase,
  PatchResumableUploadUseCase,
  GetObjectStatusUseCase,
} from '../../../application/usecases/ingest/upload.usecases';
import type { DirectUploadQueryDto, CreateResumableUploadDto } from '../dto/upload.dto';
import { InvalidOffsetException } from '../../../domain';
import Busboy from 'busboy';

@Controller('storage/uploads')
@UseGuards(AccessTokenGuard)
export class StorageUploadController {
  constructor(
    private readonly directUploadUseCase: DirectUploadUseCase,
    private readonly createResumableUploadUseCase: CreateResumableUploadUseCase,
    private readonly patchResumableUploadUseCase: PatchResumableUploadUseCase,
    private readonly completeResumableUploadUseCase: CompleteResumableUploadUseCase,
    private readonly abortResumableUploadUseCase: AbortResumableUploadUseCase,
    private readonly getUploadSessionUseCase: GetUploadSessionUseCase,
  ) {}

  @Post('direct')
  async directUpload(
    @Req() req: Request,
    @ExtractUserFromRequest() user: UserContextDto,
    @Body() query: DirectUploadQueryDto,
  ) {
    const stream = await this.parseMultipartStream(req);

    return this.directUploadUseCase.execute({
      ownerUserId: user.id,
      profile: query.profile,
      originalName: query.originalName,
      stream,
    });
  }

  @Post()
  async createResumableUpload(
    @ExtractUserFromRequest() user: UserContextDto,
    @Body() body: CreateResumableUploadDto,
  ) {
    return this.createResumableUploadUseCase.execute({
      ownerUserId: user.id,
      profile: body.profile,
      declaredSize: BigInt(body.declaredSize),
      declaredMime: body.declaredMime,
      originalName: body.originalName,
    });
  }

  @Head(':sessionId')
  async headUploadSession(
    @Param('sessionId') sessionId: string,
    @ExtractUserFromRequest() user: UserContextDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { offset } = await this.getUploadSessionUseCase.execute({
      sessionId,
      ownerUserId: user.id,
    });

    res.setHeader('Upload-Offset', offset.toString());
  }

  @Patch(':sessionId')
  async patchUploadSession(
    @Param('sessionId') sessionId: string,
    @ExtractUserFromRequest() user: UserContextDto,
    @Headers('upload-offset') uploadOffset: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks);
    const offset = BigInt(uploadOffset ?? '0');

    try {
      const result = await this.patchResumableUploadUseCase.execute({
        sessionId,
        ownerUserId: user.id,
        offset,
        body,
      });

      res.setHeader('Upload-Offset', result.offset.toString());
      return;
    } catch (error) {
      if (error instanceof InvalidOffsetException) {
        const current = await this.getUploadSessionUseCase.execute({
          sessionId,
          ownerUserId: user.id,
        });
        res.status(HttpStatus.CONFLICT);
        res.setHeader('Upload-Offset', current.offset.toString());
        return;
      }

      throw error;
    }
  }

  @Post(':sessionId/complete')
  @HttpCode(HttpStatus.ACCEPTED)
  async completeUploadSession(
    @Param('sessionId') sessionId: string,
    @ExtractUserFromRequest() user: UserContextDto,
    @Body() body: { sha256?: string },
  ): Promise<{ objectId: string; status: StorageObjectStatus }> {
    return this.completeResumableUploadUseCase.execute({
      sessionId,
      ownerUserId: user.id,
      sha256: body.sha256,
    });
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async abortUploadSession(
    @Param('sessionId') sessionId: string,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<void> {
    await this.abortResumableUploadUseCase.execute({ sessionId, ownerUserId: user.id });
  }

  private parseMultipartStream(req: Request): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let fileStream: Readable | null = null;

      busboy.on('file', (_name, stream) => {
        fileStream = stream;
        resolve(stream);
      });

      busboy.on('error', reject);
      busboy.on('finish', () => {
        if (!fileStream) {
          reject(new Error('No file part in multipart upload'));
        }
      });

      req.pipe(busboy);
    });
  }
}

@Controller('storage/objects')
@UseGuards(AccessTokenGuard)
export class StorageObjectController {
  constructor(private readonly getObjectStatusUseCase: GetObjectStatusUseCase) {}

  @Get(':objectId/status')
  getObjectStatus(
    @Param('objectId') objectId: string,
    @ExtractUserFromRequest() user: UserContextDto,
  ) {
    return this.getObjectStatusUseCase.execute({ objectId, ownerUserId: user.id });
  }
}
