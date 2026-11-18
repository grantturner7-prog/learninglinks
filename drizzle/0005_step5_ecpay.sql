CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text DEFAULT 'ecpay' NOT NULL,
	"merchant_trade_no" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"provider_trade_no" text,
	"payment_type" text,
	"rtn_code" integer,
	"rtn_msg" text,
	"payment_info" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_merchant_trade_no_unique" UNIQUE("merchant_trade_no"),
	CONSTRAINT "attempt_status_check" CHECK ("payment_attempts"."status" in ('created','awaiting','paid','failed'))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'ecpay' NOT NULL,
	"kind" text NOT NULL,
	"merchant_trade_no" text,
	"valid" boolean NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_order_idx" ON "payment_attempts" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_event_trade_idx" ON "payment_events" USING btree ("merchant_trade_no","created_at");--> statement-breakpoint
CREATE INDEX "payment_event_review_idx" ON "payment_events" USING btree ("outcome","reviewed_at");