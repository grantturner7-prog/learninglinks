CREATE TABLE "organization_photos" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"photo_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"source" text NOT NULL,
	"author" text,
	"licence" text,
	"licence_url" text,
	"source_url" text,
	"reviewed_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_photo_source_check" CHECK ("organization_photos"."source" in ('wikimedia_commons','school_upload'))
);
--> statement-breakpoint
ALTER TABLE "organization_photos" ADD CONSTRAINT "organization_photos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;