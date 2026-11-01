/**
 * Company legal defaults for Lookuvi customer/admin pages and email footers.
 * Env vars override when set. Do not invent CIN/GSTIN/phone/DLT when unset.
 */

export const DEFAULT_LEGAL_NAME = "Agentic Build Works";
export const DEFAULT_SUPPORT_EMAIL = "admin@agenticbuildworks.com";
export const DEFAULT_POSTAL_ADDRESS =
  "4-164/140, Om Nagar Colony, Kismatpur, Hyderabad 500030, Telangana, India";
export const DEFAULT_GRIEVANCE_OFFICER_NAME = "Geddam Swami Veerendra";
export const DEFAULT_GRIEVANCE_OFFICER_EMAIL = "admin@agenticbuildworks.com";
export const DEFAULT_COPYRIGHT_EMAIL = "admin@agenticbuildworks.com";
export const DEFAULT_CERT_IN_CONTACT_NAME = "Geddam Swami Veerendra";
export const DEFAULT_CERT_IN_CONTACT_EMAIL = "admin@agenticbuildworks.com";

/** Directors / founders listed on grievance / company contact. */
export const FOUNDERS = [
  "T Sai Vishwanath",
  "Polasi Madhusudhan",
  "Geddam Swami Veerendra",
] as const;

export function companyLegalName() {
  return (process.env.BRAND_LEGAL_NAME || DEFAULT_LEGAL_NAME).trim() || DEFAULT_LEGAL_NAME;
}

export function supportEmail() {
  return (process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim() || DEFAULT_SUPPORT_EMAIL;
}

export function postalAddress() {
  const fromEnv = (process.env.LEGAL_POSTAL_ADDRESS || "").trim();
  return fromEnv || DEFAULT_POSTAL_ADDRESS;
}

export function grievanceOfficerName() {
  const fromEnv = (process.env.GRIEVANCE_OFFICER_NAME || "").trim();
  return fromEnv || DEFAULT_GRIEVANCE_OFFICER_NAME;
}

export function grievanceOfficerEmail() {
  const fromEnv = (process.env.GRIEVANCE_OFFICER_EMAIL || "").trim();
  return fromEnv || DEFAULT_GRIEVANCE_OFFICER_EMAIL;
}

/** Optional. Empty when not provided — UI must not invent a phone. */
export function grievanceOfficerPhone() {
  return (process.env.GRIEVANCE_OFFICER_PHONE || "").trim();
}

export function copyrightEmail() {
  const fromEnv = (process.env.COPYRIGHT_EMAIL || "").trim();
  return fromEnv || DEFAULT_COPYRIGHT_EMAIL;
}

/** Optional. Only shown in marketing footers when set. */
export function marketingUnsubscribeUrl() {
  return (process.env.MARKETING_UNSUBSCRIBE_URL || "").trim();
}

/** Optional. Hide CIN/GSTIN lines when empty. */
export function companyCin() {
  return (process.env.COMPANY_CIN || "").trim();
}

export function companyGstin() {
  return (process.env.COMPANY_GSTIN || "").trim();
}

export function certInContactName() {
  const fromEnv = (process.env.CERT_IN_CONTACT_NAME || "").trim();
  return fromEnv || DEFAULT_CERT_IN_CONTACT_NAME;
}

export function certInContactEmail() {
  const fromEnv = (process.env.CERT_IN_CONTACT_EMAIL || "").trim();
  return fromEnv || DEFAULT_CERT_IN_CONTACT_EMAIL;
}
