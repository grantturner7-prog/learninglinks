CREATE TABLE "membership_reminders" (
	"membership_id" uuid NOT NULL,
	"days_before" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_reminders_membership_id_days_before_pk" PRIMARY KEY("membership_id","days_before")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_order_id_unique";--> statement-breakpoint
ALTER TABLE "contact_reveals" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD COLUMN "audience" text DEFAULT 'school' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_amount" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_on" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "membership_reminders" ADD CONSTRAINT "membership_reminders_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_item_uq" ON "order_items" USING btree ("order_id","organization_id");--> statement-breakpoint
CREATE INDEX "reveal_user_day_idx" ON "contact_reveals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "membership_order_idx" ON "memberships" USING btree ("order_id");