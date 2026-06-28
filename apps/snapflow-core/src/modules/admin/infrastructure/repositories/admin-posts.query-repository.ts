import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { GetAdminPostsQueryParams } from '../../application/dto/get-admin-posts-query.params';
import { PaginatedAdminPostsModel } from '../../api/models/paginated-admin-posts.model';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPostListItemModel } from '../../api/models/admin-post-list-item.model';
import { PageInfoModel } from '../../api/models/page-info.model';

@Injectable()
export class AdminPostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPosts(query: GetAdminPostsQueryParams): Promise<PaginatedAdminPostsModel> {
    const { page, pageSize, sortBy, sortDirection, search } = query;

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
    };

    if (search) {
      where.user = {
        username: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }
    const [posts, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profiles: {
                where: { deletedAt: null },
                select: { id: true, avatarUrl: true },
              },
            },
          },
          postMedias: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              fileId: true,
              url: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortDirection === AdminSortDirection.Descending ? 'desc' : 'asc',
        },
        skip: query.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.post.count({
        where: {
          deletedAt: null,
          status: PostStatus.PUBLISHED,
        },
      }),
    ]);
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    const items: AdminPostListItemModel[] = posts.map((post): AdminPostListItemModel =>
      AdminPostListItemModel.mapToModel(post),
    );

    const pageInfo: PageInfoModel = {
      page,
      pageSize,
      totalCount,
      pagesCount,
    };

    return { items, pageInfo };
  }
  async findPostById(postId: number): Promise<AdminPostListItemModel | null> {
    const rawPost = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profiles: {
              where: { deletedAt: null },
              select: { id: true, avatarUrl: true },
            },
          },
        },
        postMedias: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            fileId: true,
            url: true,
          },
        },
      },
    });
    return rawPost !== null ? AdminPostListItemModel.mapToModel(rawPost) : null;
  }
}
