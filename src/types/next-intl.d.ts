import type messages from "../../messages/en-TW";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
