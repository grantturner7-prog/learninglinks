ALTER TABLE "orders" DROP CONSTRAINT "orders_created_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;