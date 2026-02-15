/**
 * Legal Content Constants
 *
 * Privacy Policy and Terms of Service content for App Store compliance.
 * These screens are accessible from Settings and are required for Apple App Store approval.
 */

export const PRIVACY_POLICY_CONTENT = `Last Updated: February 2026

1. INTRODUCTION

Welcome to Flick ("App"). Flick is operated by Joshua Jireh Maserin ("we", "our", or "us"). We are committed to protecting your privacy and ensuring you understand how we collect, use, and share your information. This Privacy Policy explains our practices regarding your personal data when you use our photo-sharing social application.

By using Flick, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with this policy, please do not use the App.

2. INFORMATION WE COLLECT

2.1 Information You Provide Directly
- Phone Number: Your phone number in E.164 format, used for account authentication via SMS verification.
- Profile Information: Display name, username, bio, and profile photo you choose to provide.
- Profile Song: If you add a profile song, we store the song title, artist name, album artwork URL, and a 30-second preview URL sourced from Apple's iTunes catalog.
- Selects Banner: Up to 9 photos you select to display on your profile.
- Photos: Images you capture and share through the App, stored as compressed JPEG files.
- Comments: Text comments you post on photos, including optional image attachments and GIFs.
- Reactions: Emoji reactions you leave on friends' photos.
- Photo Tags: When you tag friends in your photos.
- Albums: Albums you create to organize your photos.
- Reports: If you report a user or content, the report details you submit.

2.2 Information Collected Automatically
- Device Information: Device type and operating system version to ensure App compatibility.
- Push Notification Tokens: Device tokens used to deliver notifications about photo reveals, friend requests, reactions, comments, and tags.
- Usage Indicators: Timestamps of when you capture photos, interact with content, and last changed your username. Photo view records to display "new" indicators on unseen content.
- Monthly Albums: We automatically generate monthly albums based on your photo capture dates.

2.3 Information Collected with Your Permission
- Contacts: If you grant contacts permission, we access phone numbers from your device address book to suggest friends who also use Flick. Contact phone numbers are normalized and matched against our user database but are NOT stored on our servers.

3. HOW WE USE YOUR INFORMATION

We use your information to:
- Provide and maintain the App's core functionality, including photo capture, the darkroom reveal experience, and social sharing.
- Authenticate your identity and secure your account via phone-based verification.
- Enable you to connect with friends, share photos, and interact through comments, reactions, and tags.
- Deliver push notifications about activity relevant to you (photo reveals, friend requests, reactions, comments, and tags).
- Suggest friends based on your device contacts (only with your permission).
- Enforce usage limits (such as daily photo limits and username change restrictions).
- Moderate content and enforce our Terms of Service, including processing block and report actions.
- Improve and maintain the App's performance and reliability.

4. INFORMATION SHARING

4.1 With Other Users
- Your profile information (display name, username, profile photo, bio, profile song, and Selects banner) is visible to your friends.
- Photos you add to your Journal are visible to your friends for up to 7 days in Stories and 1 day in the Feed.
- Your reactions, comments, and tags on friends' photos are visible to them and their other friends.
- Archived photos are private and visible only to you.

4.2 With Third-Party Service Providers
We use the following third-party services to operate the App:

- Firebase (Google): We use Firebase for phone authentication, database storage (Cloud Firestore), file storage (Cloud Storage), server-side logic (Cloud Functions), and push notification delivery. All user data processed through Firebase is subject to Google's privacy policy and is hosted on Google Cloud Platform infrastructure.

- Expo: We use Expo's push notification service to deliver notifications to your device. Your device push token is sent to Expo's servers for notification delivery.

- GIPHY: When you use the GIF picker in comments, your search queries are sent to GIPHY's API. No personal user data is shared with GIPHY.

- Apple iTunes Search API: When you search for a profile song, your search queries are sent to Apple's iTunes Search API. This is a public API and no personal user data is shared with Apple through this service.

4.3 What We Do NOT Do
- We do not sell your personal information to third parties.
- We do not share your data with advertisers.
- We do not use your data for targeted advertising.
- We do not use analytics or tracking SDKs.

5. DATA RETENTION

- Active Account: Your data is retained as long as your account is active.
- Deleted Content: When you delete a photo, comment, or other content, it is removed from our storage.
- Reports: Report submissions are retained permanently for safety and moderation purposes.
- Account Deletion: When you request account deletion, your account enters a 30-day grace period during which you may cancel the deletion. After the grace period, all your data is permanently and irreversibly deleted (see Section 8).

6. DATA SECURITY

We implement security measures to protect your data:
- All data is transmitted over encrypted connections (HTTPS/TLS).
- Authentication is handled through Firebase Auth with SMS verification.
- Data at rest is encrypted using industry-standard encryption (AES-256) on Google Cloud.
- Sensitive local data (such as notification tokens) is stored in encrypted device storage.
- Server-side security rules restrict data access so users can only read and modify data they are authorized to access.
- Access controls prevent users from modifying other users' data, reacting to their own photos, or accessing private archived photos.

7. YOUR RIGHTS

You have the right to:
- Access your personal information through your profile and settings in the App.
- Update or correct your profile information at any time.
- Delete individual photos, comments, and other content.
- Delete your account and all associated data (see Section 8).
- Opt out of push notifications through your device settings.
- Decline contacts permission and still use the App without friend suggestions.
- Block other users to prevent them from interacting with you.

7.1 California Residents (CCPA)
If you are a California resident, you have additional rights:
- The right to know what personal information we collect, use, and disclose.
- The right to request deletion of your personal information.
- The right to non-discrimination for exercising your privacy rights.
- We do not sell personal information as defined by the California Consumer Privacy Act.

8. ACCOUNT DELETION

You can request account deletion at any time through the Settings menu in the App. When you request deletion:
- Your account enters a 30-day grace period. During this period, you can cancel the deletion by logging back in.
- After the 30-day grace period, the following data is permanently deleted:
  - Your profile information (display name, username, bio, profile photo)
  - All your photos from the App and cloud storage
  - All your friendships and friend connections
  - All notifications associated with your account
  - All albums you created
- This action cannot be undone after the grace period expires.

9. CHILDREN'S PRIVACY

Flick is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete that information as soon as possible. If you believe a child under 13 has provided us with personal information, please contact us at maserinj@gmail.com.

10. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the App with an updated "Last Updated" date. Your continued use of the App after changes are posted constitutes your acceptance of the revised policy.

11. CONTACT US

If you have questions about this Privacy Policy or our privacy practices, please contact us at:

Joshua Jireh Maserin
Email: support@flickcam.app`;

export const TERMS_OF_SERVICE_CONTENT = `Last Updated: February 2026

1. ACCEPTANCE OF TERMS

By accessing or using the Flick application ("App", "Service"), you agree to be bound by these Terms of Service ("Terms"). The App is operated by Joshua Jireh Maserin ("we", "our", or "us"). If you do not agree to these Terms, please do not use the App.

2. ELIGIBILITY

You must be at least 13 years old to use this App. By using the App, you represent and warrant that you meet this age requirement. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms on your behalf.

3. ACCOUNT REGISTRATION

3.1 You must provide a valid phone number to create an account. Your phone number is used for authentication via SMS verification.
3.2 You are responsible for maintaining the security of your account and device.
3.3 You are responsible for all activities that occur under your account.
3.4 You must notify us immediately of any unauthorized use of your account.
3.5 You may only maintain one account. Creating multiple accounts is prohibited.

4. USER CONTENT

4.1 Ownership
You retain ownership of all photos, comments, and other content you create and share through the App ("User Content").

4.2 License to Us
By sharing User Content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, store, and distribute your content solely for the purpose of operating and providing the App's services to you and your friends. This license ends when you delete your content or your account.

4.3 Content Responsibility
You are solely responsible for your User Content and the consequences of sharing it. You represent that you have all necessary rights to share your content and that your content does not violate any third party's rights.

5. ACCEPTABLE USE

You agree NOT to:
- Share content that is illegal, harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable.
- Share content depicting minors in inappropriate or exploitative situations.
- Share sexually explicit or pornographic content.
- Impersonate any person or entity.
- Harass, bully, or intimidate other users through comments, tags, reactions, or any other feature.
- Spam other users with unwanted friend requests, comments, or tags.
- Use the App for any illegal purpose.
- Attempt to gain unauthorized access to the App, its systems, or other users' accounts.
- Interfere with or disrupt the App or its servers.
- Harvest or collect user information without consent.
- Use automated means (bots, scrapers, etc.) to access or use the App without our permission.
- Share content that infringes on the intellectual property rights of others.
- Share or redistribute other users' photos outside the App without their consent.
- Circumvent any content moderation or safety features.

6. APP FEATURES

6.1 Friend Connections
- Friend requests must be accepted by the recipient before a connection is established.
- You can remove friends at any time through the App.
- Only your friends can view your Journal photos.

6.2 Darkroom and Photo Reveals
- Photos you capture are held in a "developing" state in the Darkroom until revealed.
- Reveal times range from 0 to 5 minutes.
- Once revealed, you choose whether to keep photos in your Journal (visible to friends) or Archive (private).

6.3 Comments and Reactions
- You can react to friends' photos using emoji reactions.
- You can post comments on friends' photos, including text, image attachments, and GIFs.
- Comments support @mentions to tag other users.
- Reactions and comments are visible to the photo owner and their friends.
- Use comments and reactions respectfully and appropriately.

6.4 Photo Tagging
- You can tag friends in your photos.
- Tagged users receive a notification.
- Tagging must be used appropriately and not for harassment.

6.5 Albums
- You can create custom albums to organize your photos.
- The App automatically generates monthly albums based on your photo capture dates.

6.6 Profile Customization
- You can customize your profile with a display name, username, bio, profile photo, Selects banner, and profile song.
- Usernames must be unique and can only be changed once every 14 days.
- Profile songs use 30-second previews from Apple's iTunes catalog and are subject to Apple's terms.

6.7 Blocking and Reporting
- You can block users to prevent them from viewing your content or interacting with you.
- You can report users or content that violates these Terms. Reports are reviewed and handled at our discretion.

7. THIRD-PARTY CONTENT AND SERVICES

7.1 GIFs provided through the App are sourced from GIPHY and are subject to GIPHY's Terms of Service.
7.2 Profile song previews are sourced from Apple's iTunes catalog and are limited to 30-second previews as permitted by Apple.
7.3 We are not responsible for the availability, accuracy, or content of third-party services.

8. INTELLECTUAL PROPERTY

8.1 The App, including its design, features, code, and content (excluding User Content), is owned by Joshua Jireh Maserin and protected by intellectual property laws.
8.2 You may not copy, modify, distribute, reverse-engineer, or create derivative works of the App without our written permission.

9. COPYRIGHT AND DMCA

9.1 We respect the intellectual property rights of others. If you believe that content on the App infringes your copyright, please contact us at maserinj@gmail.com with the following information:
  - A description of the copyrighted work you claim has been infringed.
  - A description of where the infringing content is located in the App.
  - Your contact information (name, address, phone number, email).
  - A statement that you have a good faith belief that the use is not authorized by the copyright owner.
  - A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on their behalf.
  - Your physical or electronic signature.
9.2 We reserve the right to remove content that we believe infringes on others' intellectual property rights.

10. TERMINATION

10.1 You may request deletion of your account at any time through the App's Settings. Account deletion is subject to a 30-day grace period as described in our Privacy Policy.
10.2 We reserve the right to suspend or terminate your account at any time for violations of these Terms, without prior notice.
10.3 Upon termination, your right to use the App ceases immediately.
10.4 Sections 4.1 (Ownership), 8, 11, 12, 13, and 15 survive termination.

11. DISCLAIMERS

11.1 THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
11.2 WE DO NOT GUARANTEE THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
11.3 WE ARE NOT RESPONSIBLE FOR USER CONTENT SHARED BY OTHERS.
11.4 WE DO NOT ENDORSE ANY USER CONTENT AND ARE NOT LIABLE FOR ANY USER CONTENT POSTED THROUGH THE APP.

12. LIMITATION OF LIABILITY

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
12.1 IN NO EVENT SHALL JOSHUA JIREH MASERIN BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR LOSS OF GOODWILL.
12.2 OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE APP SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR FIFTY DOLLARS ($50), WHICHEVER IS GREATER.

13. INDEMNIFICATION

You agree to indemnify, defend, and hold harmless Joshua Jireh Maserin from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from your use of the App, your User Content, or your violation of these Terms.

14. DISPUTE RESOLUTION

14.1 These Terms and any disputes arising from or related to them or the App shall be governed by the laws of the State of Maryland, without regard to its conflict of law provisions.
14.2 Any legal action or proceeding arising under these Terms shall be brought exclusively in the state or federal courts located in the State of Maryland, and you consent to the personal jurisdiction of such courts.

15. APPLE APP STORE TERMS

If you downloaded the App from the Apple App Store, the following terms also apply:
15.1 These Terms are between you and Joshua Jireh Maserin, not with Apple Inc. ("Apple"). Apple is not responsible for the App or its content.
15.2 Apple has no obligation to provide any maintenance or support services for the App.
15.3 In the event of any failure of the App to conform to any applicable warranty, you may notify Apple and Apple will refund the purchase price (if any) for the App. To the maximum extent permitted by applicable law, Apple has no other warranty obligation with respect to the App.
15.4 Apple is not responsible for addressing any claims relating to the App, including but not limited to product liability claims, consumer protection claims, or intellectual property infringement claims.
15.5 In the event of any third-party claim that the App infringes that third party's intellectual property rights, Joshua Jireh Maserin, not Apple, shall be solely responsible for the investigation, defense, settlement, and discharge of any such claim.
15.6 Apple and its subsidiaries are third-party beneficiaries of these Terms, and Apple will have the right to enforce these Terms against you as a third-party beneficiary.

16. CHANGES TO TERMS

We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms in the App with an updated "Last Updated" date. Your continued use of the App after changes are posted constitutes your acceptance of the revised Terms.

17. SEVERABILITY

If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions will continue in full force and effect.

18. ENTIRE AGREEMENT

These Terms, together with our Privacy Policy, constitute the entire agreement between you and Joshua Jireh Maserin regarding your use of the App and supersede any prior agreements.

19. CONTACT

For questions about these Terms, please contact us at:

Joshua Jireh Maserin
Email: support@flickcam.app`;
