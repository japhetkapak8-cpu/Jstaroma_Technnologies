# Wantok Chat Privacy Policy

**DRAFT FOR APPROVAL - NOT APPROVED FOR PUBLICATION, NOT PUBLISHED, NOT EFFECTIVE**

Draft prepared: 11 November 2026  
Review version: wantok-legal-2026-11-11-draft-3 (shared policy release)  
Proposed public URL (not yet published): https://jstaromatechnologies.com/wantok-chat/privacy/  
Proposed approved-page file: `wantok-chat/privacy/index.html`  
Effective date: **[TO BE APPROVED]**

## Publication blockers - reviewer notes, not final policy text

- The owner has approved Japhet Moses Kapak as the published responsible individual and confirmed that wantokchat@gmail.com is monitored for support and privacy requests.
- The owner's latest instruction pauses all publication and deployment. Earlier publication permission must not be used. Resolve outstanding app behavior, provider regions, retention and deletion procedures before finalizing the publication text and effective date.
- Owner-confirmed implementation context: Android package `com.wantok.chat`, Flutter app, Supabase backend, LiveKit calling, Firebase configured. Exact production Firebase services, local project path, repository URL and release branch remain unknown. Configuration alone does not establish active collection.
- The Flutter project and production build are not in this workspace. Prior public wording is not proof that optional nearby, Google sign-in, Firebase notifications, translation, data export or deletion operate as described. Complete the provider/feature inventory below before publication.
- Confirm call recording/encryption behavior. Do not repeat an untested "calls are never recorded" or end-to-end-encryption claim.
- The live `chat-media` bucket is public. Member-read RLS alone does not protect the public object-delivery route. No private files were opened. Verify media delivery and address it separately before claiming private attachments are participant-only.
- Private transport-document buckets and restrictive direct-client policies were verified. Upload/signing endpoints, actual document types, reviewer access, document retention, operator-profile deletion and five-day cleanup were not verified.
- Approve this text together with Terms, account-deletion guidance, child-safety guidance and Google Play Data safety disclosures. This draft is not a compliance certification.
- Do not overwrite or modify the existing `/terms/` or `/privacy/` pages. The new Wantok-specific URLs are publication targets only. These notes and all bracketed confirmation notes must be resolved and removed from the approved public text.

## Approval, publication and app synchronization

This draft and [the Terms draft](./terms.md) belong to the same proposed release, `wantok-legal-2026-11-11-draft-3`. The owner has confirmed the responsible individual and monitored contact but has explicitly paused publication and deployment. These remain review material, not effective policies. Obtain approval of the final texts after outstanding facts are resolved. Both public pages and any Android-bundled text must come from the same version-controlled approved source, carry matching release metadata and use the proposed Wantok-specific canonical URLs.

The app source is absent, so no app change or completed synchronization is claimed. Final text approval is separate from permission to publish, deploy, update store links or modify the app. Do not push these drafts into a publicly served GitHub Pages tree before approval; exclusion from the Cloudflare static-build allowlist does not control every hosting configuration.

## Technical evidence needed - reviewer checklist, not public policy text

The Flutter location, repository and release branch are unknown. The following are standard Flutter locations or descriptions of implementation files to locate, not claims that a particular file exists in Wantok. Share only relevant, redacted excerpts; no credentials, personal user records or production message contents are needed.

| Evidence to inspect | What it establishes |
|---|---|
| `pubspec.yaml` and `pubspec.lock` | Installed Supabase, LiveKit, Firebase, location, notifications, analytics, translation and storage packages. Dependencies alone do not prove active collection. |
| `lib/main.dart` and the actual startup/initialization files | Services initialized in release builds, consent/collection switches and environment/flavor selection. Redact all configuration values and keys. |
| `android/app/src/main/AndroidManifest.xml`, applicable flavor manifests, and `android/app/build.gradle` or `android/app/build.gradle.kts` | Declared permissions, Android package/flavors, Firebase plugins and manifest collection/notification settings. Include relevant build configuration only, not signing credentials. |
| Actual Dart files handling Firebase notifications, Analytics, Crashlytics and Performance | Which services are called in production, device-token handling, notification payload fields, automatic collection and opt-in/out behavior. Do not send an entire `google-services.json` or `firebase_options.dart`; service names and relevant initialization logic suffice. |
| Actual Dart and server files implementing LiveKit room tokens, calls and recording/egress | Call participants and metadata, media routing, recording enablement and encryption settings. Provide redacted settings and field names, never room tokens or recordings. |
| Actual Dart files implementing People Nearby/location, profiles and privacy controls | Precise/approximate and background location use, transmitted fields, visibility, retention and permission withdrawal. Include translation/contact-book access code if active. |
| Actual Dart and server files implementing operator applications, document uploads and media delivery | Required document categories, upload bucket/endpoint, authorization, signed/public URL use, recipients and public phone-number visibility. No uploaded documents or signed URLs are needed. |
| Actual Dart and server files implementing transport chat, trip expiration and cleanup | Whether "temporary" means hidden, expired or deleted; triggers/jobs affecting messages, storage and booking records; behavior for other participants. |
| Actual account and operator-profile deletion screens, request handlers, Edge Functions/RPCs and relevant SQL migrations | In-app paths, identity verification, cascades, storage cleanup, retained/anonymized data and differences between deleting an operator profile and a full account. Never provide live user records. |
| Relevant scheduled-job/cleanup definitions and backup lifecycle settings | Actual retention periods or usable criteria for messages/media, documents, reservations, logs, audits and backups. Read-only excerpts suffice; do not run cleanup jobs for this review. |
| Provider dashboard settings or redacted deployment configuration for Supabase, LiveKit and active Firebase services | Actual hosting/processing regions, recording and diagnostic settings, processor retention, and any active translation/email/payment provider. Provider/account credentials are not needed. |
| Released app version/build and relevant flavor, plus its existing policy links/text | Which implementation the policy describes and whether Android, website and store disclosures use the same policy release. A repository/branch can be supplied later if access is available. |

Unresolved publication facts remain: hosting/processing regions, call recording and encryption, retention periods, app analytics/diagnostics collection, operator-document upload/access, transport-message deletion and account/operator-profile deletion. Backend administrative aggregates are verified separately and must not be confused with unverified Firebase Analytics. PNG legal review and alignment with Google Play disclosures remain required review steps, not completed compliance claims.

## Contents

1. Operator and scope
2. Accounts and profiles
3. Messages, groups and connections
4. Calls, devices and technical data
5. Location and optional features
6. Operator applications, vehicles and documents
7. Trips, reservations and transport communications
8. Uses and applicable permissions
9. Who can see information
10. Administration and analytics
11. Providers and international processing
12. Security and limitations
13. Retention
14. Account and operator-profile deletion
15. Choices and privacy requests
16. Children and safety
17. Changes and contact

## 1. Operator and scope

The responsible individual for Wantok Chat is **Japhet Moses Kapak**, using the **Jstaroma Technologies** project/business brand. Jstaroma Technologies is not currently registered or incorporated as a company. "We" and "our" refer to that responsible individual.

This notice covers Wantok Chat accounts, communications, social networking, community and Wantok Transport features, and related support and administration. It does not replace the hosting website's own privacy documents. Viewing a public legal page also involves the hosting website's delivery providers and observed Cloudflare performance telemetry.

The Android application is Wantok Chat, package identifier `com.wantok.chat`, built with Flutter.

Privacy and app-support contact: **[wantokchat@gmail.com](mailto:wantokchat@gmail.com)**.

This notice explains processing; it is not blanket consent. Feature availability and collection depend on the released app, choices and permissions. Sections marked for confirmation are unresolved reviewer instructions and must be completed before publication.

## 2. Accounts and profiles

We process account identifiers, sign-in/account information and profile information you provide. Depending on the implemented sign-up and profile features, these include email address, name, username, province, profile photo, description and account timestamps.

Supabase supports account authentication and database storage. Authentication services process the information needed to establish and secure a session. Do not send your password or one-time codes to support.

Other users may see profile information according to the feature used, such as identifying a sender, group member or operator. Do not put private identity documents, financial details or another person's confidential information in a public profile.

**[CONFIRM: released sign-in methods, optional versus required profile fields and any identity/age verification. If Google sign-in is enabled, identify the account data actually received from Google.]**

## 3. Messages, groups and connections

Wantok stores message and conversation information to provide communications. This includes message content and associated account/conversation identifiers, times and relevant state; media may include images, files, voice notes or other supported attachments.

We also process group details, membership and roles, friend requests/connections, reports and blocking/privacy preferences. The backend contains records for message-related settings and actions, but a database table alone does not establish that every associated feature is enabled in the released app.

Recipients and group members can see content made available to them and may copy or retain it outside the service. Publicly discoverable group/profile information has a different audience from a private conversation.

Where delivered media uses a publicly retrievable storage URL, someone who obtains the URL may be able to retrieve the file without joining the conversation. Do not assume that every shared attachment is protected only by conversation membership.

**[CONFIRM: current app media URLs and intended audiences; address public-bucket delivery if private access is intended. Confirm hiding, editing, disappearing-message and deletion effects before describing any as permanent erasure.]**

## 4. Calls, devices and technical data

LiveKit integration supports real-time calling. Call operation involves data needed to connect participants, such as participant/session identifiers and network/connection information; device microphone or camera permissions are needed for corresponding media features.

The backend also has call and call-join records. The precise metadata and diagnostic logs retained by the deployed call stack require confirmation.

**[CONFIRM: call recording settings, media/transport encryption, call-log fields, LiveKit hosting arrangement and retention. Do not publish an absolute non-recording or end-to-end-encryption assertion without verification.]**

The app and providers may process network addresses, request times, device/browser or operating-system details, app versions, errors and security events when handling requests. This does not mean every diagnostic SDK is enabled.

Device notification tokens are represented in the backend. Firebase is configured for the Flutter project, but that does not verify which Firebase services run in production. **[CONFIRM: whether push is active, which provider delivers it, the payload contents and lock-screen exposure. Verify any Firebase Analytics, Crashlytics or Performance use in the release build.]**

## 5. Location and optional features

An earlier policy described optional People Nearby, Google sign-in, message translation, no contact-book access and no advertising/analytics trackers. Their current production behavior has not been verified from the app source.

**[BEFORE PUBLICATION: replace this reviewer paragraph with the verified position for each feature.]**

- **Location/People Nearby:** if enabled, specify permission timing, precise or approximate location collected, how long it is retained, whether updates occur in the background, what other users can see and how to disable/remove it. Do not claim exact location is never disclosed without testing.
- **Contact book:** confirm permissions and code paths before stating contacts are never accessed or uploaded.
- **Translation:** if enabled, identify the provider, what message text/context is sent, the user action that initiates it and applicable provider use/retention. OpenAI appears in legacy wording but production use is unverified.
- **Advertising/diagnostics:** distinguish advertising, product usage aggregates, crash reporting and performance telemetry. Do not publish a blanket "no analytics" claim while backend administrative analytics exist.

Where a feature requires device permission or consent, its collection must match the request and a suitable explanation. Device permission is not a substitute for other permissions required by law.

## 6. Operator applications, vehicles and documents

Transport applications include operator identifiers, business/display name, contact phone, province, operating area, description, status, review note and registration/review/update timestamps.

Vehicle records include registration number, vehicle type, passenger capacity, name, color, description, status and visibility/registration-vehicle flags. Saved routes, stops and fares support operator route management.

The backend has private storage buckets for transport registration documents and business photos. Documents may contain sensitive information depending on what an applicant submits. **[CONFIRM: exact document requirements, collection channel, review audience, lawful necessity, upload/signing authorization and any redaction process. Do not invent requirements for identity cards, licences or insurance documents.]**

Use designated application channels for requested documents. Do not include unrelated personal information or another person's documents without authority. Do not place registration documents in public profile text, project-document storage or ordinary chat.

Business contacts and passenger-visible vehicle or trip information may be shared to support transport arrangements; a contact number can be personal information even if used for business.

Where an operator publishes a business phone number, it may be visible to users viewing the relevant business or trip listing, not only to a person with a confirmed reservation. A viewer can copy or contact that number outside Wantok. Operators should provide a number they are authorized to make public. **[CONFIRM the actual app audience, publication notice and visibility/update controls; do not describe an unverified public setting as already enabled.]**

## 7. Trips, reservations and transport communications

Trip records include operator and vehicle references, origin/destination, province, departure date/time and timezone, pickup details, intermediate stops, information, capacity, fares, status and timestamps. Multi-stop records support journeys between particular places.

Reservation records include a reservation identifier/reference, passenger account reference, trip and boarding/alighting stops, number of seats, fare per seat, status and relevant timestamps. One reservation can cover several passengers; the verified schema records a seat quantity rather than a separate identity for every passenger.

Cancellation and trip status changes affect availability and statistics. A recorded fare is not proof of payment, and no payment-card or settlement collection is asserted by this policy.

Booking notices and passenger/operator chat-contact links support transport-related communication. Relevant contact, booking or trip information may need to be available to the operator or passenger to arrange the journey.

**[CONFIRM: exactly what the released app displays to each party, booking notice contents, any passenger-name/contact collection outside this schema and any payment or refund service.]**

Messages associated with a trip should not be assumed to disappear when a trip ends, is cancelled or becomes hidden. A proposed five-day expiry or temporary-message cleanup is not a verified deletion practice and is not promised here.

## 8. Uses and applicable permissions

We use relevant information to:

- create and secure accounts and implement available privacy settings;
- deliver messages, calls, groups, connections and supported notifications;
- receive and review operator applications, maintain vehicles/routes and manage authorized publishing;
- create reservations, enforce segment capacity, process cancellations and issue supported notices;
- investigate reports, prevent fraud and misuse, and address safety issues;
- respond to support/privacy requests;
- measure aggregate use, booking trends and occupancy, diagnose failures and maintain the service;
- record accountable administrative decisions and comply with applicable legal obligations.

Where applicable law requires a legal ground, this may be provision of a requested service or contract, a recognized and appropriately balanced operational/security interest, a specific legal obligation or valid consent where required. The actual ground must match the activity and applicable law; this policy does not create one by itself.

Optional collection must not exceed the permission given. We do not rely on acceptance of Terms as consent for unrelated optional tracking or disclosure.

## 9. Who can see information

Depending on the feature, recipients can include:

- people you communicate with and relevant group participants;
- users viewing profile, discoverable group or published transport information;
- operators/passengers receiving the information needed for the reservation or journey;
- authorized support, safety and administration personnel for assigned duties;
- infrastructure and feature providers handling the relevant service;
- professional advisers or competent authorities where a lawful and necessary basis exists;
- another recipient you specifically authorize.

Publication and private operational processing are different. Registration documents are not intended as public trip attachments. The reviewed Jstaroma transport analytics response does not provide passenger identities or document file links.

No advertising or personal-data sale integration was identified in the audited website/backend integration. **[CONFIRM app SDKs and business practices before making a service-wide "no sale", "no advertising sharing" or "no advertising" promise.]**

Lawful requests, safety investigations and evidence preservation may require limited disclosures. We must evaluate the request and applicable law rather than treat all requests as automatically valid.

## 10. Administration and analytics

The Jstaroma portal uses a separately authenticated administrator account and server-side administrator checks to access authorized Wantok functions. It is not a public analytics feed.

Aggregate analytics cover usage and transport measures such as operator registrations, trips, reservation counts, seats, route popularity and occupancy. Cancelled reservations are excluded from occupied-seat calculations under the backend rules. Aggregation does not guarantee that small counts can never be linked to an individual in context.

Operator management shows necessary business/contact, review, vehicle and route information. The reviewed dashboard does not expose passenger account identities, private registration documents or payment-card data.

Operator decisions and trip moderation record administrator identifiers, affected record identifiers, status changes, reasons and times. These records support accountability, investigation and dispute handling. Approval/rejection can affect live trip and reservation records.

Ordinary users are not granted execution of these administrative RPCs. Privileged database credentials remain server-side in the reviewed integration. This is not an assertion that every app endpoint has undergone a complete security audit.

## 11. Providers and international processing

Verified for this integration:

- **Supabase:** authentication, database, storage and server-side administration functions across the website and Wantok projects.
- **LiveKit:** calling integration, with exact production hosting and media settings still to confirm.
- **Cloudflare/GitHub and website resource CDNs:** delivery of public policy/website pages, not evidence that these services receive every app message.

Production status requiring confirmation:

- **Google/Firebase:** Firebase configuration is owner-confirmed; active services are not. Google sign-in, notifications, Analytics, Crashlytics and Performance must each be checked separately.
- **OpenAI or another translation provider:** include only if the release actually sends text to that service.
- **Email/support and any payment provider:** identify actual services and the information handled.

**[BEFORE PUBLICATION: produce a complete deployed-provider inventory, applicable contractual arrangements, processing regions and retention information. Remove unused integrations and disclose active ones accurately.]**

Providers may process information outside Papua New Guinea. Database, storage, backup, calling, email and diagnostic regions are not yet confirmed. We do not claim PNG-only storage. Appropriate safeguards and notices must be applied where required by laws governing a transfer; this draft does not certify that those arrangements have been completed.

## 12. Security and limitations

The audited admin integration uses HTTPS, authenticated server checks, administrator membership authorization, restricted RPC execution, validated response fields and atomic transport decision auditing. Transport registration-document and business-photo buckets are private, with restrictive policies blocking direct anonymous/authenticated client access.

Private bucket settings alone do not prove that every signed URL or server endpoint is correctly authorized. Those paths require separate verification. Public avatar, group-avatar and chat-media buckets require different disclosures and controls from private document storage.

No end-to-end-encryption, permanent-erasure, security-certification or breach-free guarantee is made. We use service providers and access controls, but no system can promise that unauthorized access or disclosure will never occur.

Protect your device and account. Recipients can retain copies of shared information, and someone holding a public media URL may be able to retrieve that media. Avoid sending unnecessary sensitive information.

## 13. Retention

Retention must be based on the record's purpose, the service relationship, a specific legal requirement and proportionate safety, security, fraud or dispute needs. These reasons do not justify retaining all data indefinitely.

**[BEFORE PUBLICATION: confirm actual periods or usable criteria, responsible processes and tested deletion effects for each category below.]**

| Category | Purpose/retention considerations to verify |
|---|---|
| Accounts, profiles and authentication | Active account use, closure, recovery/security needs and provider logs. |
| Messages and media | Delivery/history, recipient copies, edits/hides/deletion, public URLs and storage cleanup. |
| Calls and diagnostics | Call history, connection troubleshooting, provider recording/logging settings. |
| Operator applications/documents | Application review, continued eligibility, rejection, appeals and document removal. |
| Vehicles, routes, trips and reservations | Journey operation, cancellations, disputes, required records and de-identification. |
| Approval/moderation audits | Accountability, investigation and justified legal retention; restrict access. |
| Support and safety reports | Request resolution, evidence needs and proportionate protection against repeat abuse. |
| Backups and processor copies | Actual rotation, restoration controls and provider deletion arrangements. |

No fixed number of days has been established by this audit. In particular, five-day trip expiry, trip hiding or temporary transport-message removal must not be described as permanent deletion from database, storage, recipients, logs or backups.

## 14. Account and operator-profile deletion

Send account-deletion requests to **wantokchat@gmail.com**. We may require proportionate account-ownership verification and enough information to identify the account. Do not send passwords, one-time codes or unnecessary identity documents.

Earlier public instructions describe an in-app Settings > Delete account action. **[CONFIRM that the released app still provides it, test backend completion and describe which profile, messages/media, tokens, reservations and document records are deleted, anonymized or retained. Update the public account-deletion page at the same time.]**

Deleting an operator profile is not necessarily the same as deleting a Wantok account. **[CONFIRM whether operator-profile removal is available and its effect on approval history, documents, public trips, existing reservations and communications.]**

We may need to retain limited information for a specific legal duty or justified safety, fraud or dispute purpose. Explain applicable exceptions and expected handling rather than promise instant erasure of every copy. Other users' copies and provider backups may have separate deletion limitations.

A privacy request does not automatically cancel an imminent journey or refund a payment. Use available cancellation/support processes as appropriate while the deletion request is handled.

## 15. Choices and privacy requests

Depending on the implemented app, you may be able to edit profile information, adjust privacy/notification settings, block/report users, leave groups and control device permissions. **[VERIFY each control, its limits and any data-export option before giving a specific settings path.]**

Depending on applicable law, you may request access, correction, deletion, a copy, restriction, objection or withdrawal of consent for processing based on consent. Legal exceptions and other people's rights may limit a request. You may also contact a competent regulator or seek another available remedy.

Send privacy requests to **wantokchat@gmail.com**. Include relevant account details and the requested action, not credentials. We will apply appropriate verification and applicable response requirements; no invented deadline is promised. Where information must be retained, its use and access should remain limited to the justified purpose.

Withdrawing a device permission does not automatically erase earlier server records. Withdrawal of consent does not make earlier lawful processing unlawful.

## 16. Children and safety

Wantok is an adult-only service for people aged 18 or older. That rule is not a guarantee that information about a minor is never received, especially in a safety report.

If we learn of an underage account or potential child exploitation, we assess the report, restrict access where appropriate and handle information in accordance with applicable safety and legal duties. Relevant evidence may need to be preserved or lawfully disclosed to appropriate authorities.

Use available reporting tools or contact **wantokchat@gmail.com**. Do not redistribute suspected illegal material to make a report. If someone is in immediate danger, use appropriate local emergency services.

## 17. Changes and contact

We will maintain a version and effective date for the approved published policy. Material changes will receive an appropriate in-app/service notice, and additional consent or other steps will be taken where required. The current approved version should be the one linked by the app, website and store listing.

Responsible individual: **Japhet Moses Kapak**, using the Jstaroma Technologies brand.  
Privacy, support and safety contact: **wantokchat@gmail.com**.

Proposed canonical policy: https://jstaromatechnologies.com/wantok-chat/privacy/  
Related proposed Terms: https://jstaromatechnologies.com/wantok-chat/terms/  
Related guidance requiring synchronized review: [Account deletion](https://jstaromatechnologies.com/account-deletion/), [Child safety](https://jstaromatechnologies.com/child-safety/).
