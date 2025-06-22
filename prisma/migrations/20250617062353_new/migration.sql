-- CreateEnum
CREATE TYPE "GenderOptions" AS ENUM ('Male', 'Female', 'Other');

-- CreateEnum
CREATE TYPE "Userstatus" AS ENUM ('Active', 'Inactive', 'Suspended');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('user', 'employee', 'guest');

-- CreateEnum
CREATE TYPE "Rolestatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "Diarystatus" AS ENUM ('Active', 'Inactive', 'Suspended');

-- CreateEnum
CREATE TYPE "DiaryType" AS ENUM ('Individual', 'Group', 'Subscription');

-- CreateEnum
CREATE TYPE "DiaryPageStatus" AS ENUM ('Pending', 'Rejected', 'Draft', 'Published', 'Scheduled');

-- CreateEnum
CREATE TYPE "DiaryInvitationStatus" AS ENUM ('Pending', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "DiaryinvitationType" AS ENUM ('Private', 'Group');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('Active', 'Expired', 'Pending');

-- CreateEnum
CREATE TYPE "FolloweddiriesStatus" AS ENUM ('followed', 'unfollowed');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "user_type" "UserType" DEFAULT 'user',
    "uuid" VARCHAR(500),
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "profile_image" TEXT,
    "profile_image_path" TEXT,
    "password" VARCHAR(255),
    "phone_code" VARCHAR(10),
    "phone" VARCHAR(100),
    "gender" "GenderOptions",
    "users_status" "Userstatus" DEFAULT 'Active',
    "reporting_head_id" BIGINT,
    "role_id" BIGINT,
    "otp" VARCHAR(10),
    "is_verified" BOOLEAN DEFAULT false,
    "otp_expiry" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,
    "joinedAt" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255),
    "default_role" BOOLEAN DEFAULT false,
    "status" "Rolestatus" DEFAULT 'Active',
    "soft_delete" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" BIGSERIAL NOT NULL,
    "role_id" BIGINT,
    "permissions" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(250),
    "iso3" VARCHAR(3),
    "iso2" VARCHAR(2),
    "phone_code" VARCHAR(10),
    "currency" VARCHAR(100),
    "currency_symbol" VARCHAR(10),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "flag" TEXT,
    "timezone_name" VARCHAR(255),
    "timezone_utc" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diaries" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT,
    "user_id" BIGINT,
    "name" TEXT,
    "featured_image_url" TEXT,
    "featured_image_path" TEXT,
    "category_id" BIGINT,
    "is_private" BOOLEAN,
    "diary_type" "DiaryType" DEFAULT 'Individual',
    "is_featured_diary" BOOLEAN DEFAULT false,
    "status" "Diarystatus" DEFAULT 'Active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_pages" (
    "id" BIGSERIAL NOT NULL,
    "diary_id" BIGINT NOT NULL,
    "page_no" INTEGER,
    "content" TEXT,
    "featured_image" TEXT,
    "is_publish_date" TIMESTAMPTZ,
    "view_count" BIGINT DEFAULT 0,
    "share_count" BIGINT DEFAULT 0,
    "added_by" BIGINT,
    "status" "DiaryPageStatus" DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diary_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_categories" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diary_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT,
    "user_id" BIGINT,
    "name" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "message" TEXT,
    "is_guest" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT,
    "profile_image_url" TEXT,
    "profile_image_path" TEXT,
    "name" TEXT,
    "designation" TEXT,
    "experience" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" BIGSERIAL NOT NULL,
    "uid" VARCHAR(255),
    "sender_id" BIGINT,
    "receiver_id" BIGINT,
    "message" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_comments" (
    "id" BIGSERIAL NOT NULL,
    "diary_id" BIGINT NOT NULL,
    "single_page_id" BIGINT,
    "user_id" BIGINT NOT NULL,
    "comment" TEXT NOT NULL,
    "parent_comment_id" BIGINT,
    "likes" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diary_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "id" BIGSERIAL NOT NULL,
    "uid" VARCHAR(255),
    "comment_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_invitations" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT,
    "diary_id" BIGINT NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "type" "DiaryinvitationType" DEFAULT 'Private',
    "status" "DiaryInvitationStatus" DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diary_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_diaries_by_link" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT,
    "diary_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" "DiaryinvitationType" DEFAULT 'Private',
    "access_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "shared_diaries_by_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_info" (
    "id" BIGSERIAL NOT NULL,
    "companyname" VARCHAR(255),
    "address_one" TEXT,
    "address_two" TEXT,
    "city" VARCHAR(255),
    "state" VARCHAR(255),
    "country" VARCHAR(255),
    "zipcode" VARCHAR(255),
    "phone_code" TEXT,
    "phone" VARCHAR(255),
    "email" VARCHAR(255),
    "white_logo_url" VARCHAR(255),
    "white_logo_path" VARCHAR(255),
    "dark_logo_url" VARCHAR(255),
    "dark_logo_path" VARCHAR(255),
    "favicon_url" VARCHAR(255),
    "favicon_path" VARCHAR(255),
    "facebook_url" VARCHAR(255),
    "twitter_url" VARCHAR(255),
    "instagram_url" VARCHAR(255),
    "linkedin_url" VARCHAR(255),
    "youtube_url" VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "company_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_diaries" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT,
    "user_id" BIGINT,
    "diary_id" BIGINT,
    "status" "SubscriptionStatus" DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "subscription_diaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_diary_page_likes" (
    "id" BIGSERIAL NOT NULL,
    "uid" VARCHAR(255),
    "diary_id" BIGINT,
    "single_page_id" BIGINT,
    "isliked" BOOLEAN DEFAULT false,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "single_diary_page_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_likes" (
    "id" BIGSERIAL NOT NULL,
    "uid" VARCHAR(255),
    "diary_id" BIGINT,
    "user_id" BIGINT NOT NULL,
    "isliked" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diary_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followed_diaries" (
    "id" BIGSERIAL NOT NULL,
    "uid" VARCHAR(255),
    "diary_id" BIGINT,
    "user_id" BIGINT NOT NULL,
    "status" "FolloweddiriesStatus" DEFAULT 'unfollowed',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "followed_diaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_notification" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "message" TEXT,
    "type" VARCHAR(255),
    "is_read" BOOLEAN DEFAULT false,
    "added_by" BIGINT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "users_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_page_views" (
    "id" BIGSERIAL NOT NULL,
    "diary_id" BIGINT,
    "single_page_id" BIGINT,
    "user_id" BIGINT,
    "user_type" "UserType" DEFAULT 'guest',
    "last_view_date" TIMESTAMPTZ,
    "session_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "diary_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_name_index" ON "users"("name");

-- CreateIndex
CREATE INDEX "users_phone_index" ON "users"("phone_code", "phone");

-- CreateIndex
CREATE INDEX "roles_name_index" ON "roles"("name");

-- CreateIndex
CREATE INDEX "rolepermissions_role_id_index" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "country_name" ON "countries"("name");

-- CreateIndex
CREATE INDEX "phone_code" ON "countries"("phone_code");

-- CreateIndex
CREATE UNIQUE INDEX "diaries_uuid_key" ON "diaries"("uuid");

-- CreateIndex
CREATE INDEX "diary_name" ON "diaries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_uuid_key" ON "team"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "comment_likes_comment_id_user_id_key" ON "comment_likes"("comment_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "diary_invitations_uuid_key" ON "diary_invitations"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "shared_diaries_by_link_uuid_key" ON "shared_diaries_by_link"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "shared_diaries_by_link_access_token_key" ON "shared_diaries_by_link"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_diaries_uuid_key" ON "subscription_diaries"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "single_diary_page_likes_user_id_single_page_id_key" ON "single_diary_page_likes"("user_id", "single_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "diary_likes_user_id_diary_id_key" ON "diary_likes"("user_id", "diary_id");

-- CreateIndex
CREATE UNIQUE INDEX "followed_diaries_user_id_diary_id_key" ON "followed_diaries"("user_id", "diary_id");

-- CreateIndex
CREATE UNIQUE INDEX "diary_page_views_session_token_key" ON "diary_page_views"("session_token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reporting_head_id_fkey" FOREIGN KEY ("reporting_head_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diaries" ADD CONSTRAINT "diaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diaries" ADD CONSTRAINT "diaries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "diary_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_pages" ADD CONSTRAINT "diary_pages_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_pages" ADD CONSTRAINT "diary_pages_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_comments" ADD CONSTRAINT "diary_comments_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_comments" ADD CONSTRAINT "diary_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_comments" ADD CONSTRAINT "diary_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "diary_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_comments" ADD CONSTRAINT "diary_comments_single_page_id_fkey" FOREIGN KEY ("single_page_id") REFERENCES "diary_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "diary_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_invitations" ADD CONSTRAINT "diary_invitations_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_invitations" ADD CONSTRAINT "diary_invitations_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_invitations" ADD CONSTRAINT "diary_invitations_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_diaries_by_link" ADD CONSTRAINT "shared_diaries_by_link_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_diaries_by_link" ADD CONSTRAINT "shared_diaries_by_link_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_diaries" ADD CONSTRAINT "subscription_diaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_diaries" ADD CONSTRAINT "subscription_diaries_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_diary_page_likes" ADD CONSTRAINT "single_diary_page_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_diary_page_likes" ADD CONSTRAINT "single_diary_page_likes_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_diary_page_likes" ADD CONSTRAINT "single_diary_page_likes_single_page_id_fkey" FOREIGN KEY ("single_page_id") REFERENCES "diary_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_likes" ADD CONSTRAINT "diary_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_likes" ADD CONSTRAINT "diary_likes_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_diaries" ADD CONSTRAINT "followed_diaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_diaries" ADD CONSTRAINT "followed_diaries_diary_id_fkey" FOREIGN KEY ("diary_id") REFERENCES "diaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_notification" ADD CONSTRAINT "users_notification_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_page_views" ADD CONSTRAINT "diary_page_views_single_page_id_fkey" FOREIGN KEY ("single_page_id") REFERENCES "diary_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
