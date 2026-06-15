--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: BookingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BookingStatus" AS ENUM (
    'PENDING',
    'PAID',
    'CHECKED_IN',
    'CHECKED_OUT',
    'CANCELLED',
    'WAITING_APPROVAL',
    'APPROVED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'SUCCESS',
    'REFUNDED',
    'FAILED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'GUEST',
    'PARTNER',
    'ADMIN'
);


--
-- Name: SealStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SealStatus" AS ENUM (
    'STOCK',
    'ASSIGNED',
    'IN_USE',
    'RETURNED',
    'FAULTY'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: AdminRoleChangeRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdminRoleChangeRequest" (
    id text NOT NULL,
    "targetUserId" text NOT NULL,
    "previousRole" public."Role" NOT NULL,
    "requestedRole" public."Role" NOT NULL,
    "requestedByUserId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorUserId" text,
    "actorRole" text NOT NULL,
    action text NOT NULL,
    "entityType" text,
    "entityId" text,
    metadata jsonb,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BlockedIp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BlockedIp" (
    ip text NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BlogPost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BlogPost" (
    id text NOT NULL,
    locale text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    excerpt text,
    "coverImage" text,
    "authorName" text DEFAULT 'BagajPark Ekibi'::text NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Booking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Booking" (
    id text NOT NULL,
    "guestId" text,
    "shopId" text NOT NULL,
    status public."BookingStatus" DEFAULT 'PENDING'::public."BookingStatus" NOT NULL,
    "checkInTime" timestamp(3) without time zone NOT NULL,
    "checkOutTime" timestamp(3) without time zone NOT NULL,
    "bagCountS" integer DEFAULT 0 NOT NULL,
    "bagCountM" integer DEFAULT 0 NOT NULL,
    "bagCountXl" integer DEFAULT 0 NOT NULL,
    "unitPrice" numeric(12,2) DEFAULT 50 NOT NULL,
    "totalPrice" numeric(12,2) DEFAULT 0 NOT NULL,
    "insuranceFee" numeric(12,2) DEFAULT 0 NOT NULL,
    "qrCodeToken" text,
    "sealPhotoUrl" text,
    "lateFeeApplied" numeric(12,2) DEFAULT 0 NOT NULL,
    "pendingBagRevision" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bookingRowVersion" integer DEFAULT 0 NOT NULL,
    "referredByCode" text,
    "referralDiscountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "guestEmail" text,
    "guestPhone" text
);


--
-- Name: BookingEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BookingEvent" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    event text NOT NULL,
    "actorId" text,
    "actorRole" public."Role",
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BookingSeal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BookingSeal" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    "sealNumber" integer NOT NULL,
    "bagIndex" integer NOT NULL,
    "bagSize" text NOT NULL,
    "photoUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Campaign" (
    id text NOT NULL,
    name text NOT NULL,
    message text,
    "discountPercent" numeric(5,2),
    "isActive" boolean DEFAULT true NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ContactMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContactMessage" (
    id text NOT NULL,
    "from" text NOT NULL,
    "to" text NOT NULL,
    subject text,
    text text,
    html text,
    "isRead" boolean DEFAULT false NOT NULL,
    raw jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Coupon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Coupon" (
    id text NOT NULL,
    code text NOT NULL,
    discount numeric(12,2) NOT NULL,
    "isPercent" boolean DEFAULT true NOT NULL,
    "minPrice" numeric(12,2) DEFAULT 0,
    "maxUses" integer DEFAULT 100,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Dispute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Dispute" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    reason text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "adminNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FeatureFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeatureFlag" (
    id text NOT NULL,
    key text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "rolloutPct" integer DEFAULT 100 NOT NULL,
    "allowedUserIds" jsonb,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LegalAcceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LegalAcceptance" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "documentKey" text NOT NULL,
    version text NOT NULL,
    "acceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip text
);


--
-- Name: NotificationLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationLog" (
    id text NOT NULL,
    "bookingId" text,
    type text NOT NULL,
    recipient text NOT NULL,
    subject text,
    content text NOT NULL,
    status text DEFAULT 'SENT'::text NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PaymentLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentLog" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    "transactionId" text,
    amount numeric(12,2) NOT NULL,
    status public."PaymentStatus" DEFAULT 'SUCCESS'::public."PaymentStatus" NOT NULL,
    "splitCompleted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "chargebackStatus" text,
    "chargebackNote" text
);


--
-- Name: PlatformSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformSettings" (
    id text DEFAULT 'default'::text NOT NULL,
    "maxStayDays" integer DEFAULT 30 NOT NULL,
    "maxBagsPerSlot" integer DEFAULT 50 NOT NULL,
    "insuranceFeeTry" numeric(12,2) DEFAULT 15 NOT NULL,
    "earlyRefundRatio" numeric(6,4) DEFAULT 0.9 NOT NULL,
    "cancelFixedFeeTry" numeric(12,2) DEFAULT 20 NOT NULL,
    "defaultShopCapacity" integer DEFAULT 10 NOT NULL,
    "defaultPricePerDay" numeric(12,2) DEFAULT 50 NOT NULL,
    "bagMultiplierS" numeric(6,4) DEFAULT 0.8 NOT NULL,
    "bagMultiplierM" numeric(6,4) DEFAULT 1.0 NOT NULL,
    "bagMultiplierXl" numeric(6,4) DEFAULT 1.5 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "platformHolidayDates" jsonb
);


--
-- Name: PushSubscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PushSubscription" (
    id text NOT NULL,
    "userId" text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    "bookingId" text NOT NULL,
    "guestId" text NOT NULL,
    "shopId" text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Seal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Seal" (
    "serialNumber" integer NOT NULL,
    "shopId" text,
    status public."SealStatus" DEFAULT 'STOCK'::public."SealStatus" NOT NULL,
    "assignedAt" timestamp(3) without time zone
);


--
-- Name: SealRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SealRequest" (
    id text NOT NULL,
    "shopId" text NOT NULL,
    quantity integer NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "trackingNumber" text,
    "adminNote" text,
    "serialFrom" integer,
    "serialTo" integer,
    "autoGenerated" boolean DEFAULT false NOT NULL,
    "requestedBy" text
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Shop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Shop" (
    id text NOT NULL,
    "ownerId" text NOT NULL,
    name text NOT NULL,
    address text,
    latitude double precision,
    longitude double precision,
    capacity integer DEFAULT 10 NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    rating double precision DEFAULT 0.0,
    "pricePerDay" numeric(12,2) DEFAULT 50 NOT NULL,
    "hasRestroom" boolean DEFAULT false NOT NULL,
    open247 boolean DEFAULT false NOT NULL,
    "openingTime" text DEFAULT '09:00'::text,
    "closingTime" text DEFAULT '20:00'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sealReorderPoint" integer DEFAULT 15 NOT NULL,
    "sealLeadTimeDays" integer DEFAULT 3 NOT NULL,
    city text,
    district text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "responseTimeMinutes" integer DEFAULT 0,
    image text,
    description text,
    "hasCctv" boolean DEFAULT false NOT NULL,
    "hasClimateControl" boolean DEFAULT false NOT NULL,
    "acceptsLargeItems" boolean DEFAULT false NOT NULL
);


--
-- Name: ShopImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShopImage" (
    id text NOT NULL,
    "shopId" text NOT NULL,
    url text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    role public."Role" DEFAULT 'GUEST'::public."Role" NOT NULL,
    email text,
    "emailVerified" timestamp(3) without time zone,
    image text,
    phone text,
    name text,
    "passwordHash" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isBanned" boolean DEFAULT false NOT NULL,
    "lastIp" text,
    "referralCode" text,
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "tokenVersion" integer DEFAULT 0 NOT NULL
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: AdminRoleChangeRequest AdminRoleChangeRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminRoleChangeRequest"
    ADD CONSTRAINT "AdminRoleChangeRequest_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BlockedIp BlockedIp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlockedIp"
    ADD CONSTRAINT "BlockedIp_pkey" PRIMARY KEY (ip);


--
-- Name: BlogPost BlogPost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlogPost"
    ADD CONSTRAINT "BlogPost_pkey" PRIMARY KEY (id);


--
-- Name: BookingEvent BookingEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingEvent"
    ADD CONSTRAINT "BookingEvent_pkey" PRIMARY KEY (id);


--
-- Name: BookingSeal BookingSeal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingSeal"
    ADD CONSTRAINT "BookingSeal_pkey" PRIMARY KEY (id);


--
-- Name: Booking Booking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_pkey" PRIMARY KEY (id);


--
-- Name: Campaign Campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_pkey" PRIMARY KEY (id);


--
-- Name: ContactMessage ContactMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactMessage"
    ADD CONSTRAINT "ContactMessage_pkey" PRIMARY KEY (id);


--
-- Name: Coupon Coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Coupon"
    ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY (id);


--
-- Name: Dispute Dispute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_pkey" PRIMARY KEY (id);


--
-- Name: FeatureFlag FeatureFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureFlag"
    ADD CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY (id);


--
-- Name: LegalAcceptance LegalAcceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LegalAcceptance"
    ADD CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY (id);


--
-- Name: NotificationLog NotificationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);


--
-- Name: PaymentLog PaymentLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentLog"
    ADD CONSTRAINT "PaymentLog_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSettings PlatformSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformSettings"
    ADD CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY (id);


--
-- Name: PushSubscription PushSubscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PushSubscription"
    ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: SealRequest SealRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SealRequest"
    ADD CONSTRAINT "SealRequest_pkey" PRIMARY KEY (id);


--
-- Name: Seal Seal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Seal"
    ADD CONSTRAINT "Seal_pkey" PRIMARY KEY ("serialNumber");


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: ShopImage ShopImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShopImage"
    ADD CONSTRAINT "ShopImage_pkey" PRIMARY KEY (id);


--
-- Name: Shop Shop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shop"
    ADD CONSTRAINT "Shop_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: AdminRoleChangeRequest_requestedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdminRoleChangeRequest_requestedByUserId_idx" ON public."AdminRoleChangeRequest" USING btree ("requestedByUserId");


--
-- Name: AdminRoleChangeRequest_targetUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AdminRoleChangeRequest_targetUserId_key" ON public."AdminRoleChangeRequest" USING btree ("targetUserId");


--
-- Name: AuditLog_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorUserId_idx" ON public."AuditLog" USING btree ("actorUserId");


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: BlogPost_isPublished_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlogPost_isPublished_idx" ON public."BlogPost" USING btree ("isPublished");


--
-- Name: BlogPost_locale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlogPost_locale_idx" ON public."BlogPost" USING btree (locale);


--
-- Name: BlogPost_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BlogPost_slug_key" ON public."BlogPost" USING btree (slug);


--
-- Name: BookingEvent_bookingId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON public."BookingEvent" USING btree ("bookingId", "createdAt");


--
-- Name: BookingEvent_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BookingEvent_bookingId_idx" ON public."BookingEvent" USING btree ("bookingId");


--
-- Name: BookingSeal_bookingId_bagIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BookingSeal_bookingId_bagIndex_key" ON public."BookingSeal" USING btree ("bookingId", "bagIndex");


--
-- Name: BookingSeal_sealNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BookingSeal_sealNumber_idx" ON public."BookingSeal" USING btree ("sealNumber");


--
-- Name: Booking_checkInTime_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_checkInTime_idx" ON public."Booking" USING btree ("checkInTime");


--
-- Name: Booking_checkOutTime_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_checkOutTime_idx" ON public."Booking" USING btree ("checkOutTime");


--
-- Name: Booking_guestEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_guestEmail_idx" ON public."Booking" USING btree ("guestEmail");


--
-- Name: Booking_guestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_guestId_idx" ON public."Booking" USING btree ("guestId");


--
-- Name: Booking_qrCodeToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Booking_qrCodeToken_key" ON public."Booking" USING btree ("qrCodeToken");


--
-- Name: Booking_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_shopId_idx" ON public."Booking" USING btree ("shopId");


--
-- Name: Booking_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_status_idx" ON public."Booking" USING btree (status);


--
-- Name: Coupon_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Coupon_code_key" ON public."Coupon" USING btree (code);


--
-- Name: Coupon_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Coupon_expiresAt_idx" ON public."Coupon" USING btree ("expiresAt");


--
-- Name: Coupon_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Coupon_isActive_idx" ON public."Coupon" USING btree ("isActive");


--
-- Name: Dispute_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Dispute_bookingId_key" ON public."Dispute" USING btree ("bookingId");


--
-- Name: FeatureFlag_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureFlag_key_idx" ON public."FeatureFlag" USING btree (key);


--
-- Name: FeatureFlag_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON public."FeatureFlag" USING btree (key);


--
-- Name: LegalAcceptance_documentKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LegalAcceptance_documentKey_idx" ON public."LegalAcceptance" USING btree ("documentKey");


--
-- Name: LegalAcceptance_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LegalAcceptance_userId_idx" ON public."LegalAcceptance" USING btree ("userId");


--
-- Name: NotificationLog_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationLog_bookingId_idx" ON public."NotificationLog" USING btree ("bookingId");


--
-- Name: NotificationLog_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationLog_recipient_idx" ON public."NotificationLog" USING btree (recipient);


--
-- Name: PaymentLog_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentLog_bookingId_key" ON public."PaymentLog" USING btree ("bookingId");


--
-- Name: PaymentLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentLog_createdAt_idx" ON public."PaymentLog" USING btree ("createdAt");


--
-- Name: PaymentLog_splitCompleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentLog_splitCompleted_idx" ON public."PaymentLog" USING btree ("splitCompleted");


--
-- Name: PaymentLog_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentLog_status_idx" ON public."PaymentLog" USING btree (status);


--
-- Name: PaymentLog_transactionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentLog_transactionId_key" ON public."PaymentLog" USING btree ("transactionId");


--
-- Name: PushSubscription_endpoint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON public."PushSubscription" USING btree (endpoint);


--
-- Name: PushSubscription_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PushSubscription_userId_idx" ON public."PushSubscription" USING btree ("userId");


--
-- Name: Review_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Review_bookingId_key" ON public."Review" USING btree ("bookingId");


--
-- Name: Review_guestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_guestId_idx" ON public."Review" USING btree ("guestId");


--
-- Name: Review_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_shopId_idx" ON public."Review" USING btree ("shopId");


--
-- Name: SealRequest_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SealRequest_shopId_idx" ON public."SealRequest" USING btree ("shopId");


--
-- Name: SealRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SealRequest_status_idx" ON public."SealRequest" USING btree (status);


--
-- Name: Seal_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Seal_shopId_idx" ON public."Seal" USING btree ("shopId");


--
-- Name: Seal_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Seal_status_idx" ON public."Seal" USING btree (status);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: ShopImage_shopId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShopImage_shopId_idx" ON public."ShopImage" USING btree ("shopId");


--
-- Name: Shop_active_coords_partial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shop_active_coords_partial_idx" ON public."Shop" USING btree (latitude, longitude) WHERE (("isActive" = true) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: Shop_active_location_gist_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shop_active_location_gist_idx" ON public."Shop" USING gist (public.geography(public.st_setsrid(public.st_makepoint(longitude, latitude), 4326))) WHERE (("isActive" = true) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: Shop_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shop_isActive_idx" ON public."Shop" USING btree ("isActive");


--
-- Name: Shop_latitude_longitude_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shop_latitude_longitude_idx" ON public."Shop" USING btree (latitude, longitude);


--
-- Name: Shop_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shop_ownerId_idx" ON public."Shop" USING btree ("ownerId");


--
--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: User_referralCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_referralCode_key" ON public."User" USING btree ("referralCode");


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: idx_booking_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_status ON public."Booking" USING btree (status);


--
-- Name: idx_featureflag_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featureflag_key ON public."FeatureFlag" USING btree (key);


--
-- Name: idx_shop_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_is_active ON public."Shop" USING btree ("isActive") WHERE ("isActive" = true);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AdminRoleChangeRequest AdminRoleChangeRequest_requestedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminRoleChangeRequest"
    ADD CONSTRAINT "AdminRoleChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AdminRoleChangeRequest AdminRoleChangeRequest_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdminRoleChangeRequest"
    ADD CONSTRAINT "AdminRoleChangeRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BookingSeal BookingSeal_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingSeal"
    ADD CONSTRAINT "BookingSeal_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BookingSeal BookingSeal_sealNumber_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BookingSeal"
    ADD CONSTRAINT "BookingSeal_sealNumber_fkey" FOREIGN KEY ("sealNumber") REFERENCES public."Seal"("serialNumber") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Booking Booking_guestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Booking Booking_shopId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Dispute Dispute_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LegalAcceptance LegalAcceptance_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LegalAcceptance"
    ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationLog NotificationLog_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentLog PaymentLog_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentLog"
    ADD CONSTRAINT "PaymentLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PushSubscription PushSubscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PushSubscription"
    ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Review Review_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Review Review_guestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Review Review_shopId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SealRequest SealRequest_shopId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SealRequest"
    ADD CONSTRAINT "SealRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Seal Seal_shopId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Seal"
    ADD CONSTRAINT "Seal_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShopImage ShopImage_shopId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShopImage"
    ADD CONSTRAINT "ShopImage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES public."Shop"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Shop Shop_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shop"
    ADD CONSTRAINT "Shop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
