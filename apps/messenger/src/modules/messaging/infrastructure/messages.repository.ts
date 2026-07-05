import { Injectable } from '@nestjs/common';
import { Message } from '@generated/prisma-messenger';
import { PrismaService } from '../../database/prisma.service';

export class CreateMessageRepositoryDto {
  chatId: number;
  senderId: number;
  text: string;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageRepositoryDto): Promise<Message> {
    return this.prisma.message.create({
      data: {
        chatId: dto.chatId,
        senderId: dto.senderId,
        text: dto.text,
      },
    });
  }

  async findById(id: number): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
    });
  }
}
