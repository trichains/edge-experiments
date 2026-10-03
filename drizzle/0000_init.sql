CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"experiment_key" text NOT NULL,
	"variant" text NOT NULL,
	"visitor_id" text NOT NULL,
	"kind" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"props" jsonb,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"traffic_allocation" integer DEFAULT 100 NOT NULL,
	"variants" jsonb NOT NULL,
	"targeting" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mode" text DEFAULT 'header' NOT NULL,
	"path" text NOT NULL,
	"primary_goal" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rollout" integer DEFAULT 0 NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_experiment_key_experiments_key_fk" FOREIGN KEY ("experiment_key") REFERENCES "public"."experiments"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_idx" ON "events" USING btree ("experiment_key","visitor_id","kind","goal");--> statement-breakpoint
CREATE INDEX "events_experiment_kind_idx" ON "events" USING btree ("experiment_key","kind","variant");