import { e } from "xsuite";

export const DEFAULT_REFERRAL_PERCENTAGE = 1_000;
export const ESDT_TOKEN1 = "CTO-123456";
export const ESDT_TOKEN1_AMOUNT = 2_000;
export const ESDT_TOKEN2 = "CTO-654321";
export const ESDT_TOKEN2_AMOUNT = 3_000;
export const TOTAL_TOKEN_AMOUNT = 10_000;
export const NEW_REFERRAL_PERCENTEAGE = 2_000;
export const REFERRAL_CODE1 = "REF123";
export const REFERRAL_CODE2 = "REF789";
export const EGLD_AMOUNT = 1_000;
export const MAX_PERCENTAGE = 10_000;

export const baseKvs = [
  e.kvs
    .Mapper("default_referral_percentage")
    .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
];
