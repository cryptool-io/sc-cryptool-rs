import { e } from "xsuite";

export const TOKEN_ID = "CTO-123456";
export const TOKEN_DECIMALS = 18;
export const BLOCK_ZERO = 0;
export const REWARDS_START_BLOCK = 10;
export const BLOCK_INCREMENT = 10;
export const DIVISION_SAFETY_CONSTANT = BigInt(10 ** 9);
export const REWARDS_DAYS = BigInt(1);
export const DEFAULT_STAKE_AMOUNT = BigInt(100 * 10 ** TOKEN_DECIMALS);
export const DEFAULT_UNSTAKE_AMOUNT = BigInt(50 * 10 ** TOKEN_DECIMALS);
export const DEFAULT_WALLET_AMOUNT = BigInt(1000 * 10 ** TOKEN_DECIMALS);
const SECONDS_IN_DAY = 86400;
const SECONDS_PER_BLOCK = 6;
export const REWARDS = BigInt(
  (SECONDS_IN_DAY / SECONDS_PER_BLOCK) * 10 ** TOKEN_DECIMALS,
);
export const REWARDS_PER_BLOCK = 1 * 10 ** TOKEN_DECIMALS;
export const START_TIMESTAMP = 10;
export const END_TIMESTAMP = 1000;
export const ZERO = 0n;
export const TIER_0 = 0;
export const TIER_1 = 1;
export const TIER_2 = 2;

export const baseKvs = [
  e.kvs.Mapper("token_id").Value(e.Str(TOKEN_ID)),
  e.kvs.Mapper("start_timestamp").Value(e.U64(START_TIMESTAMP)),
  e.kvs.Mapper("rewards_per_block").Value(e.U(REWARDS_PER_BLOCK)),
  e.kvs.Mapper("end_timestamp").Value(e.U64(END_TIMESTAMP)),
  e.kvs.Mapper("state").Value(e.U(1)),
  e.kvs.Mapper("division_safety_constant").Value(e.U(DIVISION_SAFETY_CONSTANT)),
  e.kvs.Mapper("produce_rewards_enabled").Value(e.U(1)),
  e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
];
