ALTER TABLE "jobs" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "report_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_open_uq" ON "reports" USING btree ("reporter_user_id","target_type","target_id") WHERE "reports"."status" = 'open';