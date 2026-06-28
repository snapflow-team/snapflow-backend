import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { Server } from 'http';
import { Configuration } from '../../src/setup/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { PostTestManager } from '../managers/post.test-manager';
import { CreatePostInputDto } from '../../src/modules/posts/api/input-dto/create-post.input-dto';

const ADMIN_POSTS_QUERY = `
query AdminPosts($input: AdminPostsQueryInput) {
  adminPosts(input: $input) {
    items {
      id
      description
      createdAt
      postMedias {
        fileId
        url
        postMediaId
      }
      owner {
        profileId
        userId
        username
        avatarUrl
      }
    }
    pageInfo {
      page
      pageSize
      totalCount
      pagesCount
    }
  }
}
`;

describe('AdminPostsResolver - adminPosts() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let postTestManager: PostTestManager;
  let server: Server;
  let sessionCookie: string;
  let adminSettings: AdminSettings;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);

    adminSettings = configService.get<AdminSettings>('adminSettings');

    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);

    postTestManager = new PostTestManager(appTestManager.prisma);

    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть опубликованные посты с пагинацией', async () => {
    const createPostInputDto1 = new CreatePostInputDto();
    createPostInputDto1.description = 'first post';
    createPostInputDto1.fileIds = ['someId'];

    const createPostInputDto2 = new CreatePostInputDto();
    createPostInputDto2.description = 'second post';
    createPostInputDto2.fileIds = ['someId'];

    const user = await adminUsersTestManager.createUser();
    await postTestManager.createPublishedPost(
      user.id,
      [createPostInputDto1, createPostInputDto2],
      2,
    );

    const res = await adminUsersTestManager.gql(
      ADMIN_POSTS_QUERY,
      {
        input: {
          page: 1,
          pageSize: 10,
        },
      },
      sessionCookie,
    );
    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    expect(res.body.data.adminPosts.pageInfo).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 2,
      pagesCount: 1,
    });

    expect(res.body.data.adminPosts.items).toHaveLength(2);
  });

  it('не должен возвращать удаленные посты', async () => {
    const createPostInputDto1 = new CreatePostInputDto();
    createPostInputDto1.description = 'visible';
    createPostInputDto1.fileIds = ['someId'];

    const createPostInputDto2 = new CreatePostInputDto();
    createPostInputDto2.description = 'deleted';
    createPostInputDto2.fileIds = ['someId'];

    const user = await adminUsersTestManager.createUser();
    await postTestManager.createPublishedPost(user.id, [createPostInputDto1], 1);
    await postTestManager.createPublishedDeletedPost(user.id, [createPostInputDto2], 1);

    const res = await adminUsersTestManager.gql(ADMIN_POSTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    expect(res.body.data.adminPosts.items).toHaveLength(1);
    expect(res.body.data.adminPosts.items[0].description).toBe('visible');
  });

  it('не должен возвращать неопубликованные посты', async () => {
    const createPostInputDto = new CreatePostInputDto();
    createPostInputDto.description = 'draft post';
    createPostInputDto.fileIds = ['someId'];

    const user = await adminUsersTestManager.createUser();

    await postTestManager.createDraftPost(user.id, [createPostInputDto], 1);

    const res = await adminUsersTestManager.gql(ADMIN_POSTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    expect(res.body.data.adminPosts.items).toHaveLength(0);
  });

  it('должен фильтровать посты по username', async () => {
    const createPostInputDto1 = new CreatePostInputDto();
    createPostInputDto1.description = 'alex`s post';
    createPostInputDto1.fileIds = ['someId'];

    const createPostInputDto2 = new CreatePostInputDto();
    createPostInputDto2.description = 'john`s post';
    createPostInputDto2.fileIds = ['someId'];

    const user1 = await adminUsersTestManager.createUser({ username: 'alex' });
    const user2 = await adminUsersTestManager.createUser({ username: 'john' });
    await postTestManager.createPublishedPost(user1.id, [createPostInputDto1], 1);
    await postTestManager.createPublishedPost(user2.id, [createPostInputDto2], 1);

    const res = await adminUsersTestManager.gql(
      ADMIN_POSTS_QUERY,
      {
        input: {
          search: 'alex',
        },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    expect(res.body.data.adminPosts.items).toHaveLength(1);
    expect(res.body.data.adminPosts.items[0].owner.username).toBe('alex');
  });

  it('должен сортировать посты по createdAt по убыванию', async () => {
    const createPostInputDto1 = new CreatePostInputDto();
    createPostInputDto1.description = 'older';
    createPostInputDto1.fileIds = ['someId'];

    const createPostInputDto2 = new CreatePostInputDto();
    createPostInputDto2.description = 'newer';
    createPostInputDto2.fileIds = ['someId'];

    const user = await adminUsersTestManager.createUser();
    await postTestManager.createPublishedPost(
      user.id,
      [createPostInputDto1, createPostInputDto2],
      2,
    );

    const res = await adminUsersTestManager.gql(
      ADMIN_POSTS_QUERY,
      {
        input: {
          sortBy: 'CreatedAt',
          sortDirection: 'Descending',
        },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);

    expect(res.body.data.adminPosts.items[0].description).toBe('newer');
    expect(res.body.data.adminPosts.items[1].description).toBe('older');
  });

  it('должен корректно работать с пагинацией', async () => {
    const user = await adminUsersTestManager.createUser();
    for (let i = 0; i < 15; i++) {
      await postTestManager.createPublishedPost(user.id);
    }

    const res = await adminUsersTestManager.gql(
      ADMIN_POSTS_QUERY,
      {
        input: {
          page: 2,
          pageSize: 10,
        },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);

    expect(res.body.data.adminPosts.items).toHaveLength(5);

    expect(res.body.data.adminPosts.pageInfo).toEqual({
      page: 2,
      pageSize: 10,
      totalCount: 15,
      pagesCount: 2,
    });
  });

  it('должен возвращать пустой список, если постов нет', async () => {
    const res = await adminUsersTestManager.gql(ADMIN_POSTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    expect(res.body.data.adminPosts.items).toEqual([]);

    expect(res.body.data.adminPosts.pageInfo).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 0,
      pagesCount: 0,
    });
  });
});
