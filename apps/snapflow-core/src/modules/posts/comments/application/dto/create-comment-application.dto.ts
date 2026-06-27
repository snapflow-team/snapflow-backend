export class CreateCommentApplicationDto {
  userId: number;
  postId: number;
  text: string;
  parentId: number | null;
}
