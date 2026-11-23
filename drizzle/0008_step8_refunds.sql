CREATE TABLE "order_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"refunded_on" date NOT NULL,
	"reason" text NOT NULL,
	"request_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_refunds_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "refund_amount_check" CHECK ("order_refunds"."amount" > 0),
	CONSTRAINT "refund_method_check" CHECK ("order_refunds"."method" in ('ecpay_backoffice','bank_transfer','other'))
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "ended_early_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "ended_early_by" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "ended_early_reason" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "original_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_order_idx" ON "order_refunds" USING btree ("order_id");