CREATE TYPE "public"."price_tier" AS ENUM('budget', 'mid-range', 'luxury');--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"description" text NOT NULL,
	"hero_image_url" text NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avg_rating" double precision DEFAULT 0 NOT NULL,
	"price_tier" "price_tier" NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"trending_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "destinations_name_country_unique" UNIQUE("name","country")
);
