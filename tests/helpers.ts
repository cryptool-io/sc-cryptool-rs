import { e } from "xsuite";

export const DEFAULT_REFERRAL_PERCENTAGE = 1000;
export const ESDT_TOKEN1 = "CTO-123456";
export const ESDT_TOKEN1_AMOUNT = 1500;
export const ESDT_TOKEN2 = "ABC-654321";
export const ESDT_TOKEN2_AMOUNT = 3000;
export const TOTAL_TOKEN_AMOUNT = 10000;
export const NEW_REFERRAL_PERCENTEAGE = 2000;
export const REFERRAL_CODE1 = "REF123";
export const REFERRAL_CODE2 = "REF789";
export const EGLD_AMOUNT = 1000;
export const MAX_PERCENTAGE = 10000;

export const baseKvs = [
  e.kvs
    .Mapper("default_referral_percentage")
    .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
];
