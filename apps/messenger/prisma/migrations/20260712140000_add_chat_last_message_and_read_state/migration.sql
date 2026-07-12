-- AlterTable
ALTER TABLE "chats" ADD COLUMN "last_message_id" INTEGER,
ADD COLUMN "last_message_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_read_states" (
    "id" SERIAL NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "last_read_message_id" INTEGER,
    "last_read_at" TIMESTAMP(3),

    CONSTRAINT "chat_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chats_last_message_id_key" ON "chats"("last_message_id");

-- CreateIndex
CREATE INDEX "chats_participant_a_id_last_message_at_idx" ON "chats"("participant_a_id", "last_message_at");

-- CreateIndex
CREATE INDEX "chats_participant_b_id_last_message_at_idx" ON "chats"("participant_b_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_read_states_chat_id_user_id_key" ON "chat_read_states"("chat_id", "user_id");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
