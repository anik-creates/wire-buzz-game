/**
 * Compatibility bridge: Forward to Firebase Realtime Database Sync Engine
 */
if (window.firebaseSync) {
  window.cloudSync = window.firebaseSync;
}
