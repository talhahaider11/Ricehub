# Android release signing key

The Android release keystore is sensitive signing material. Keep it and its
passwords out of source control, chat, and unencrypted backups.

## Repository status

`frontend/ricemarket-release.jks` was present in Git history. Ignoring and
untracking it prevents it from being added to future commits, but does not
remove it from existing commits or copies of the repository.

If this repository was public, shared with people who should not have signing
access, or its exposure cannot be ruled out, treat the upload key as exposed.
Check the app's Play Console signing setup and follow Google's upload-key reset
process before relying on a replacement key. Do not delete the only usable key
or change signing keys until the Play Console recovery path is understood.

## Handling the key safely

- Keep the working keystore outside the repository when practical.
- Store a backup in an encrypted, access-controlled location separate from the
  working copy.
- Put `RICEHUB_KEYSTORE_FILE`, `RICEHUB_KEYSTORE_PASSWORD`,
  `RICEHUB_KEY_ALIAS`, and `RICEHUB_KEY_PASSWORD` in the user-level Gradle
  properties file (`%USERPROFILE%\.gradle\gradle.properties` on Windows), not
  the tracked project `gradle.properties`.
- Confirm the local release build points to the intended keystore and alias
  before producing an AAB.
- After any key rotation, verify the upload and app-signing configuration in
  Play Console before distributing a release.

The API 36 release bundle currently builds unsigned because no protected
signing credentials are configured. Do not upload it to Play Console; configure
signing only after confirming the correct key and Play Console recovery plan.

Removing the keystore from Git history requires a coordinated history rewrite
and force-push, and does not erase existing clones or remote backups. Do not
attempt that cleanup without coordinating with everyone using the repository.
