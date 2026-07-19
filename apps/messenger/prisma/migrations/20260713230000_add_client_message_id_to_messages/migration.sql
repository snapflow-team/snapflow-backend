-- AlterTable
ALTER TABLE "messages" ADD COLUMN "client_message_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "messages_chat_id_sender_id_client_message_id_key" ON "messages"("chat_id", "sender_id", "client_message_id");

