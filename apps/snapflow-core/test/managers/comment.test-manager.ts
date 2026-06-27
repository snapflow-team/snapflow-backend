import { Comment } from '@generated/prisma-snapflow';
import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { PrismaService } from '../../src/database/prisma.service';
import { CreateCommentInputDto } from '../../src/modules/posts/comments/api/input-dto/create-comment.input-dto';
import { CommentItemViewDto } from '../../src/modules/posts/comments/api/view-dto/comment-item.view-dto';
import { PostCommentsPageViewDto } from '../../src/modules/posts/comments/api/view-dto/post-comments-page.view-dto';

export class CommentTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  async create(
    accessToken: string,
    postId: number,
    body: CreateCommentInputDto,
    expectedStatus: number = HttpStatus.CREATED,
  ): Promise<Response> {
    return request(this.server)
      .post(`/${GLOBAL_PREFIX}/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body)
      .expect(expectedStatus);
  }

  async createAndGetBody(
    accessToken: string,
    postId: number,
    body: CreateCommentInputDto,
  ): Promise<CommentItemViewDto> {
    const res: Response = await this.create(accessToken, postId, body);

    return res.body as CommentItemViewDto;
  }

  async getPostComments(
    postId: number,
    query: { cursor?: string; limit?: number } = {},
    accessToken?: string,
    expectedStatus: number = HttpStatus.OK,
  ): Promise<Response> {
    const req = request(this.server)
      .get(`/${GLOBAL_PREFIX}/posts/${postId}/comments`)
      .query(query);

    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }

    return req.expect(expectedStatus);
  }

  async getPostCommentsBody(
    postId: number,
    query: { cursor?: string; limit?: number } = {},
    accessToken?: string,
  ): Promise<PostCommentsPageViewDto> {
    const res: Response = await this.getPostComments(postId, query, accessToken);

    return res.body as PostCommentsPageViewDto;
  }

  async getCommentReplies(
    postId: number,
    commentId: number,
    query: { cursor?: string; limit?: number } = {},
    accessToken?: string,
    expectedStatus: number = HttpStatus.OK,
  ): Promise<Response> {
    const req = request(this.server)
      .get(`/${GLOBAL_PREFIX}/posts/${postId}/comments/${commentId}/replies`)
      .query(query);

    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }

    return req.expect(expectedStatus);
  }

  async getCommentRepliesBody(
    postId: number,
    commentId: number,
    query: { cursor?: string; limit?: number } = {},
    accessToken?: string,
  ): Promise<PostCommentsPageViewDto> {
    const res: Response = await this.getCommentReplies(postId, commentId, query, accessToken);

    return res.body as PostCommentsPageViewDto;
  }

  async seedRootComment(data: {
    postId: number;
    userId: number;
    text: string;
    createdAt?: Date;
  }): Promise<Comment> {
    return this.prisma.comment.create({
      data: {
        postId: data.postId,
        userId: data.userId,
        text: data.text,
        parentId: null,
        createdAt: data.createdAt,
      },
    });
  }

  async seedReply(data: {
    postId: number;
    userId: number;
    parentId: number;
    text: string;
    createdAt?: Date;
  }): Promise<Comment> {
    return this.prisma.comment.create({
      data: {
        postId: data.postId,
        userId: data.userId,
        text: data.text,
        parentId: data.parentId,
        createdAt: data.createdAt,
      },
    });
  }

  async softDelete(commentId: number): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }
}
