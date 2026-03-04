import { Module } from '@nestjs/common';
import { PostsMediaController } from './post-media-files/api/posts-media.controller';

const controllers = [PostsMediaController];

@Module({
  imports: [],
  controllers: [...controllers],
  providers: [],
  exports: [],
})
export class MediaModule {}
