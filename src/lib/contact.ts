import type { ContactMethod, EmailConfig, PhoneConfig } from "@/types/contact";

export const FALLBACK_CONTACT_EMAIL =
  import.meta.env.VITE_FALLBACK_CONTACT_EMAIL ?? "support@skypanel.cloud";

export const FALLBACK_CONTACT_PHONE =
  import.meta.env.VITE_FALLBACK_CONTACT_PHONE ?? "+1 (800) 555-0199";

type EmailLikeConfig = Partial<EmailConfig> & Record<string, unknown>;
type PhoneLikeConfig = Partial<PhoneConfig> & Record<string, unknown>;

export function getEmailDetails(method?: ContactMethod | null) {
  const config = (method?.config ?? {}) as EmailLikeConfig;
  const address =
    (typeof config.email_address === "string" && config.email_address.trim()) ||
    (typeof config.email === "string" && config.email.trim()) ||
    (typeof config.emailAddress === "string" && config.emailAddress.trim()) ||
    FALLBACK_CONTACT_EMAIL;

  const responseTime =
    (typeof config.response_time === "string" && config.response_time.trim()) ||
    (typeof config.responseTime === "string" && config.responseTime.trim()) ||
    "";

  return {
    address,
    responseTime,
    title: method?.title ?? "",
    description: method?.description ?? "",
  };
}

export function getPhoneDetails(method?: ContactMethod | null) {
  const config = (method?.config ?? {}) as PhoneLikeConfig;
  const number =
    (typeof config.phone_number === "string" && config.phone_number.trim()) ||
    (typeof (config as Record<string, unknown>).phone === "string" &&
      ((config as Record<string, string>).phone ?? "").trim()) ||
    (typeof config.phoneNumber === "string" && config.phoneNumber.trim()) ||
    FALLBACK_CONTACT_PHONE;

  const availability =
    (typeof config.availability_text === "string" && config.availability_text.trim()) ||
    (typeof (config as Record<string, unknown>).availability === "string" &&
      ((config as Record<string, string>).availability ?? "").trim()) ||
    "";

  return {
    number,
    availability,
    title: method?.title ?? "",
    description: method?.description ?? "",
  };
}
