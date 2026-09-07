-- Hand-written: btree_gist lets a GiST index combine an equality column (uuid) with a range.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."revision_change_type" AS ENUM('update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'viewer');--> statement-breakpoint
CREATE TABLE "rental_unit_revisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rental_unit_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_type" "revision_change_type" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"postal_code" text,
	"country" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reservation_revisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reservation_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_type" "revision_change_type" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_unit_id" uuid NOT NULL,
	"guest_name" text NOT NULL,
	"guest_email" text,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reservations_dates_check" CHECK ("reservations"."check_out" > "reservations"."check_in")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "rental_unit_revisions" ADD CONSTRAINT "rental_unit_revisions_rental_unit_id_rental_units_id_fk" FOREIGN KEY ("rental_unit_id") REFERENCES "public"."rental_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_unit_revisions" ADD CONSTRAINT "rental_unit_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_revisions" ADD CONSTRAINT "reservation_revisions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_revisions" ADD CONSTRAINT "reservation_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rental_unit_id_rental_units_id_fk" FOREIGN KEY ("rental_unit_id") REFERENCES "public"."rental_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_unit_revisions_unit_idx" ON "rental_unit_revisions" USING btree ("rental_unit_id","version");--> statement-breakpoint
CREATE INDEX "rental_units_active_name_idx" ON "rental_units" USING btree ("deleted_at","name");--> statement-breakpoint
CREATE INDEX "reservation_revisions_reservation_idx" ON "reservation_revisions" USING btree ("reservation_id","version");--> statement-breakpoint
CREATE INDEX "reservations_unit_check_in_idx" ON "reservations" USING btree ("rental_unit_id","check_in");--> statement-breakpoint
CREATE INDEX "reservations_period_idx" ON "reservations" USING btree ("check_in","check_out");--> statement-breakpoint
-- Hand-written: the double-booking rule, enforced by the database so two concurrent
-- requests can never both succeed. Half-open range [check_in, check_out) means
-- back-to-back stays (checkout 10th, checkin 10th) are allowed. Soft-deleted rows
-- free their slot via the partial predicate. Violations raise SQLSTATE 23P01 which
-- the API maps to 409 RESERVATION_OVERLAP.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlap_excl"
  EXCLUDE USING gist ("rental_unit_id" WITH =, daterange("check_in", "check_out", '[)') WITH &&)
  WHERE ("deleted_at" IS NULL);
