import { ClientProxy } from '@nestjs/microservices';
import { NEVER, of, throwError, TimeoutError } from 'rxjs';
import { ValidationException } from '../../../../../../libs/exceptions/core';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { FilesClient } from './files.client';
import { SnapFlowDomainExceptionCodeMapper } from '../../../common/exceptions/snapflow-domain-exception-mapper';
import { AsyncLocalStorageService } from '../../../common/async-local-storage/async-local-storage.service';
import { REQUEST_ID_KEY } from '../../../../../../libs/common/constants/request-id.constants';
import {
  BadRequestException,
  InternalServerException,
  NotFoundException,
} from '../../../common/exceptions/domain-exceptions';
import {
  ConfirmUploadRequest,
  DeleteFileRequest,
  FilesRpcCommand,
  GenerateUploadUrlsRequest,
  MimeType,
  UploadFileRequest,
  ValidateFilesRequest,
} from '../../../../../../libs/contracts/files';

describe('FilesClient', () => {
  let filesClient: FilesClient;
  let sendMock: jest.Mock;
  let alsStore: Map<string, string>;
  let alsMock: Pick<AsyncLocalStorageService, 'getStore'>;

  beforeEach(() => {
    sendMock = jest.fn();
    alsStore = new Map();
    alsMock = { getStore: () => alsStore };

    filesClient = new FilesClient(
      { send: sendMock } as unknown as ClientProxy,
      new SnapFlowDomainExceptionCodeMapper(),
      alsMock as AsyncLocalStorageService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('generateUploadUrl: возвращает ответ RPC', async () => {
    const payload: GenerateUploadUrlsRequest = {
      userId: 42,
      files: [{ mimeType: MimeType.PNG, size: 1024 }],
    };
    const response = [{ uploadUrl: 'https://example.com/u', fileId: 'f-1' }];
    sendMock.mockReturnValue(of(response));

    const result = await filesClient.generateUploadUrl(payload);

    expect(result).toEqual(response);
    expect(sendMock).toHaveBeenCalledWith(
      { cmd: FilesRpcCommand.GenerateUploadUrl },
      { data: payload, meta: { requestId: null } },
    );
  });

  it('confirmUpload: возвращает ответ RPC', async () => {
    const payload: ConfirmUploadRequest = { userId: 42, fileIds: ['f-1'] };
    const response = { success: true };
    sendMock.mockReturnValue(of(response));

    const result = await filesClient.confirmUpload(payload);

    expect(result).toEqual(response);
    expect(sendMock).toHaveBeenCalledWith(
      { cmd: FilesRpcCommand.ConfirmUpload },
      { data: payload, meta: { requestId: null } },
    );
  });

  it('validateFiles: возвращает ответ RPC', async () => {
    const payload: ValidateFilesRequest = { userId: 42, fileIds: ['f-1'] };
    const response = {
      valid: true,
      files: [{ fileId: 'f-1', url: 'https://example.com/f-1', mimeType: 'image/png', size: 10 }],
    };
    sendMock.mockReturnValue(of(response));

    const result = await filesClient.validateFiles(payload);

    expect(result).toEqual(response);
    expect(sendMock).toHaveBeenCalledWith(
      { cmd: FilesRpcCommand.ValidateFiles },
      { data: payload, meta: { requestId: null } },
    );
  });

  it('uploadFile: возвращает ответ RPC', async () => {
    const payload: UploadFileRequest = {
      userId: 42,
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from('avatar'),
    };
    const response = { publicUrl: 'https://example.com/avatar.png' };
    sendMock.mockReturnValue(of(response));

    const result = await filesClient.uploadFile(payload);

    expect(result).toEqual(response);
    expect(sendMock).toHaveBeenCalledWith(
      { cmd: FilesRpcCommand.UploadFile },
      { data: payload, meta: { requestId: null } },
    );
  });

  it('deleteFile: возвращает ответ RPC', async () => {
    const payload: DeleteFileRequest = { userId: 42, fileUrl: 'https://example.com/f-1' };
    const response = { success: true };
    sendMock.mockReturnValue(of(response));

    const result = await filesClient.deleteFile(payload);

    expect(result).toEqual(response);
    expect(sendMock).toHaveBeenCalledWith(
      { cmd: FilesRpcCommand.DeleteFile },
      { data: payload, meta: { requestId: null } },
    );
  });

  it('кладёт requestId из ALS в meta envelope', async () => {
    alsStore.set(REQUEST_ID_KEY, 'req-from-als');
    const payload: GenerateUploadUrlsRequest = {
      userId: 42,
      files: [{ mimeType: MimeType.PNG, size: 1024 }],
    };
    sendMock.mockReturnValue(of([]));

    await filesClient.generateUploadUrl(payload);

    expect(sendMock).toHaveBeenCalledWith(
      { cmd: FilesRpcCommand.GenerateUploadUrl },
      { data: payload, meta: { requestId: 'req-from-als' } },
    );
  });

  it('маппит rpc-ошибку BadRequest в BadRequestException', async () => {
    sendMock.mockReturnValue(
      throwError(() => ({
        service: SERVICES.FILES,
        code: 'BadRequest',
        message: 'Invalid file payload',
        extensions: [],
        timestamp: new Date().toISOString(),
        pattern: FilesRpcCommand.UploadFile,
      })),
    );

    await expect(
      filesClient.uploadFile({
        userId: 1,
        mimetype: 'image/png',
        size: 1,
        buffer: Buffer.from('x'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('маппит rpc-ошибку NotFound в NotFoundException', async () => {
    sendMock.mockReturnValue(
      throwError(() => ({
        service: SERVICES.FILES,
        code: 'NotFound',
        message: 'File not found',
        extensions: [],
        timestamp: new Date().toISOString(),
        pattern: FilesRpcCommand.DeleteFile,
      })),
    );

    await expect(
      filesClient.deleteFile({ userId: 1, fileUrl: 'https://example.com/missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('маппит rpc-ошибку ValidationError в ValidationException', async () => {
    sendMock.mockReturnValue(
      throwError(() => ({
        service: SERVICES.FILES,
        code: 'ValidationError',
        message: 'Validation failed',
        extensions: [{ field: 'fileId', message: 'Invalid format' }],
        timestamp: new Date().toISOString(),
        pattern: FilesRpcCommand.ConfirmUpload,
      })),
    );

    await expect(
      filesClient.confirmUpload({ userId: 1, fileIds: ['bad-id'] }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('маппит неизвестный rpc-код в InternalServerException', async () => {
    sendMock.mockReturnValue(
      throwError(() => ({
        service: SERVICES.FILES,
        code: 'UnknownCode',
        message: 'Unexpected',
        extensions: [],
        timestamp: new Date().toISOString(),
        pattern: FilesRpcCommand.GenerateUploadUrl,
      })),
    );

    await expect(filesClient.generateUploadUrl({ userId: 1, files: [] })).rejects.toBeInstanceOf(
      InternalServerException,
    );
  });

  it('пробрасывает не-rpc ошибки без маппинга', async () => {
    const networkError = new Error('ECONNREFUSED');
    sendMock.mockReturnValue(throwError(() => networkError));

    await expect(filesClient.validateFiles({ userId: 1, fileIds: ['f-1'] })).rejects.toBe(
      networkError,
    );
  });

  it('выбрасывает TimeoutError, если сервис не ответил до таймаута', async () => {
    jest.useFakeTimers();
    sendMock.mockReturnValue(NEVER);

    const request = filesClient.generateUploadUrl({ userId: 1, files: [] });

    jest.advanceTimersByTime(5_100);

    await expect(request).rejects.toBeInstanceOf(TimeoutError);
  });
});
