CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"account_type" text DEFAULT 'educator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_reveals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"educator_id" uuid NOT NULL,
	"channels" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"educator_id" uuid NOT NULL,
	"started_by_user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_status_check" CHECK ("conversations"."status" in ('open','blocked','closed'))
);
--> statement-breakpoint
CREATE TABLE "educator_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_key" text NOT NULL,
	"document_version" text NOT NULL,
	"locale" text NOT NULL,
	"text_hash" text NOT NULL,
	"items" jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "educator_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"educator_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "educator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"country_code" text DEFAULT 'TW' NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"photo_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_country" text,
	"open_to_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"city" text,
	"districts" text[] DEFAULT '{}'::text[] NOT NULL,
	"subjects" text[] DEFAULT '{}'::text[] NOT NULL,
	"levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"teaching_modes" text[] DEFAULT '{}'::text[] NOT NULL,
	"open_to" text[] DEFAULT '{}'::text[] NOT NULL,
	"work_authorization" text,
	"experience_band" text,
	"rate_min" integer,
	"rate_max" integer,
	"credentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "educator_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "educator_status_check" CHECK ("educator_profiles"."status" in ('draft','published','hidden','suspended')),
	CONSTRAINT "educator_rate_check" CHECK ("educator_profiles"."rate_min" is null or "educator_profiles"."rate_max" is null or "educator_profiles"."rate_min" <= "educator_profiles"."rate_max")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"subjects" text[] DEFAULT '{}'::text[] NOT NULL,
	"levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"city" text,
	"district" text,
	"salary_min" integer,
	"salary_max" integer,
	"salary_unit" text,
	"starts_on" date,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_status_check" CHECK ("jobs"."status" in ('open','closed'))
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holder_type" text NOT NULL,
	"holder_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "membership_term_check" CHECK ("memberships"."ends_at" > "memberships"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "message_body_check" CHECK (char_length("messages"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holder_type" text NOT NULL,
	"holder_id" text NOT NULL,
	"plan_code" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"country_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"reference_code" text NOT NULL,
	"invoice_tax_id" text,
	"invoice_title" text,
	"invoice_email" text,
	"created_by_user_id" text NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_reference_code_unique" UNIQUE("reference_code"),
	CONSTRAINT "order_status_check" CHECK ("orders"."status" in ('pending','paid','cancelled')),
	CONSTRAINT "order_amount_check" CHECK ("orders"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "org_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_role" text NOT NULL,
	"contact_phone" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_status_check" CHECK ("org_claims"."status" in ('pending','approved','rejected'))
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text DEFAULT 'TW' NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"type" text NOT NULL,
	"city" text,
	"district" text,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"website" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"status" text DEFAULT 'unclaimed' NOT NULL,
	"claimed_at" timestamp with time zone,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_status_check" CHECK ("organizations"."status" in ('unclaimed','claimed','suspended'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_status_check" CHECK ("reports"."status" in ('open','actioned','dismissed'))
);
--> statement-breakpoint
CREATE TABLE "substitute_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"educator_id" uuid NOT NULL,
	"available_from" timestamp with time zone DEFAULT now() NOT NULL,
	"available_until" timestamp with time zone NOT NULL,
	"districts" text[] DEFAULT '{}'::text[] NOT NULL,
	"subjects" text[] DEFAULT '{}'::text[] NOT NULL,
	"levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "substitute_availability_educator_id_unique" UNIQUE("educator_id")
);
--> statement-breakpoint
CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"country_code" text NOT NULL,
	"audience" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_educator_id_educator_profiles_id_fk" FOREIGN KEY ("educator_id") REFERENCES "public"."educator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_educator_id_educator_profiles_id_fk" FOREIGN KEY ("educator_id") REFERENCES "public"."educator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educator_consents" ADD CONSTRAINT "educator_consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educator_contacts" ADD CONSTRAINT "educator_contacts_educator_id_educator_profiles_id_fk" FOREIGN KEY ("educator_id") REFERENCES "public"."educator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educator_profiles" ADD CONSTRAINT "educator_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_claims" ADD CONSTRAINT "org_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_claims" ADD CONSTRAINT "org_claims_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitute_availability" ADD CONSTRAINT "substitute_availability_educator_id_educator_profiles_id_fk" FOREIGN KEY ("educator_id") REFERENCES "public"."educator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "reveal_org_day_idx" ON "contact_reveals" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "reveal_educator_idx" ON "contact_reveals" USING btree ("educator_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_pair_uq" ON "conversations" USING btree ("organization_id","educator_id");--> statement-breakpoint
CREATE INDEX "conversation_educator_idx" ON "conversations" USING btree ("educator_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversation_org_idx" ON "conversations" USING btree ("organization_id","last_message_at");--> statement-breakpoint
CREATE INDEX "consent_user_idx" ON "educator_consents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "educator_contact_channel_uq" ON "educator_contacts" USING btree ("educator_id","channel");--> statement-breakpoint
CREATE INDEX "educator_status_country_idx" ON "educator_profiles" USING btree ("status","country_code");--> statement-breakpoint
CREATE INDEX "educator_city_idx" ON "educator_profiles" USING btree ("city");--> statement-breakpoint
CREATE INDEX "educator_subjects_gin" ON "educator_profiles" USING gin ("subjects");--> statement-breakpoint
CREATE INDEX "educator_levels_gin" ON "educator_profiles" USING gin ("levels");--> statement-breakpoint
CREATE INDEX "educator_districts_gin" ON "educator_profiles" USING gin ("districts");--> statement-breakpoint
CREATE INDEX "job_open_idx" ON "jobs" USING btree ("status","city","created_at");--> statement-breakpoint
CREATE INDEX "job_org_idx" ON "jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "membership_holder_idx" ON "memberships" USING btree ("holder_type","holder_id","ends_at");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "order_holder_idx" ON "orders" USING btree ("holder_type","holder_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_pending_uq" ON "org_claims" USING btree ("organization_id","user_id") WHERE "org_claims"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "claim_status_idx" ON "org_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "org_member_user_idx" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_source_uq" ON "organizations" USING btree ("source","source_id") WHERE "organizations"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "org_city_type_idx" ON "organizations" USING btree ("city","type");--> statement-breakpoint
CREATE INDEX "org_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "substitute_until_idx" ON "substitute_availability" USING btree ("available_until");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_uq" ON "waitlist_signups" USING btree ("email","country_code","audience");