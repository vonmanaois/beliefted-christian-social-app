import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const parsedServiceAccount = rawServiceAccount
  ? (JSON.parse(rawServiceAccount) as ServiceAccount)
  : null;

const getAdminApp = () => {
  if (getApps().length) return getApps()[0]!;
  if (!parsedServiceAccount) {
    return null;
  }
  return initializeApp({
    credential: cert(parsedServiceAccount),
  });
};

export const getAdminMessaging = () => {
  const app = getAdminApp();
  if (!app) return null;
  return getMessaging(app);
};
