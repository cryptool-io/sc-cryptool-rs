import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, LSWorld, LSWallet, LSContract, e } from "xsuite";

import {
  baseKvs,
  TOKEN_ID,
  START_TIMESTAMP,
  END_TIMESTAMP,
  REWARDS,
  TOKEN_DECIMALS,
  BLOCK_ZERO,
  REWARDS_START_BLOCK,
  DIVISION_SAFETY_CONSTANT,
  DEFAULT_STAKE_AMOUNT,
  ZERO,
  REWARDS_PER_BLOCK,
  BLOCK_INCREMENT,
  DEFAULT_WALLET_AMOUNT,
  DEFAULT_UNSTAKE_AMOUNT,
  TIER_0,
  TIER_1,
  TIER_2,
} from "./helpers";

import { signerAddress } from "./signatures/common.ts";
import { aliceAddress, SIGNATURE_ALICE } from "./signatures/alice.ts";
import { bobAddress, SIGNATURE_BOB } from "./signatures/bob.ts";
import { carolAddress, SIGNATURE_CAROL } from "./signatures/carol.ts";
import { daveAddress, SIGNATURE_DAVE } from "./signatures/dave.ts";

let world: LSWorld;
let alice: LSWallet;
let bob: LSWallet;
let carol: LSWallet;
let dave: LSWallet;
let deployer: LSWallet;
let signer: LSWallet;
let walletDababaseContract: LSContract;
let contract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start();
  deployer = await world.createWallet({
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: TOKEN_ID, amount: REWARDS }])],
  });

  signer = await world.createWallet({
    balance: 100_000,
    address: signerAddress,
  });

  alice = await world.createWallet({
    balance: 100_000,
    address: aliceAddress,
    kvs: [e.kvs.Esdts([{ id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT }])],
  });

  bob = await world.createWallet({
    balance: 100_000,
    address: bobAddress,
    kvs: [e.kvs.Esdts([{ id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT }])],
  });

  carol = await world.createWallet({
    balance: 100_000,
    address: carolAddress,
    kvs: [e.kvs.Esdts([{ id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT }])],
  });

  dave = await world.createWallet({
    balance: 100_000,
    address: daveAddress,
    kvs: [e.kvs.Esdts([{ id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT }])],
  });

  ({ contract: walletDababaseContract } = await deployer.deployContract({
    code: "file:wallet-database/output/wallet-database.wasm",
    codeMetadata: [],
    codeArgs: [e.Addr(signer)],
    gasLimit: 10_000_000,
  }));

  ({ contract } = await deployer.deployContract({
    code: "file:stake-pool/output/stake-pool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Str(TOKEN_ID),
      e.U64(START_TIMESTAMP),
      e.U64(END_TIMESTAMP),
      e.Addr(walletDababaseContract),
    ],
  }));
});

afterEach(async () => {
  world.terminate();
});

test("Complex scenario - check readme for details", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "addRewards",
    funcArgs: [e.U(REWARDS_PER_BLOCK)],
    esdts: [{ id: TOKEN_ID, amount: REWARDS }],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "resume",
  });

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(BLOCK_ZERO)),
      e.kvs.Esdts([{ id: TOKEN_ID, amount: REWARDS }]),
    ],
  });

  await world.setCurrentBlockInfo({
    timestamp: REWARDS_START_BLOCK,
  });

  var current_block = REWARDS_START_BLOCK;

  await alice.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(REWARDS_START_BLOCK), e.TopBuffer(SIGNATURE_ALICE)],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(REWARDS_START_BLOCK), e.TopBuffer(SIGNATURE_BOB)],
  });

  await carol.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(REWARDS_START_BLOCK), e.TopBuffer(SIGNATURE_CAROL)],
  });

  await dave.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(REWARDS_START_BLOCK), e.TopBuffer(SIGNATURE_DAVE)],
  });

  //

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  var rewards_per_share = BigInt(0);
  var total_staked = DEFAULT_STAKE_AMOUNT;
  var alice_rewards_per_share = rewards_per_share;
  var alice_pending_rewards = BigInt(0);
  var alice_tier0_block = current_block;

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs.Esdts([{ id: TOKEN_ID, amount: REWARDS + DEFAULT_STAKE_AMOUNT }]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_1)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;
  total_staked += DEFAULT_STAKE_AMOUNT;
  var bob_rewards_per_share = rewards_per_share;
  const bob_tier1_block = current_block;

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(alice)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: REWARDS + DEFAULT_STAKE_AMOUNT * BigInt(2) },
      ]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await carol.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_2)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;
  total_staked += DEFAULT_STAKE_AMOUNT;
  var carol_rewards_per_share = rewards_per_share;
  var carol_tier2_block = current_block;

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(alice)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: REWARDS + DEFAULT_STAKE_AMOUNT * BigInt(3) },
      ]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await dave.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;
  total_staked += DEFAULT_STAKE_AMOUNT;
  var dave_rewards_per_share = rewards_per_share;
  var dave_tier0_block = current_block;

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(alice)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: REWARDS + DEFAULT_STAKE_AMOUNT * BigInt(4) },
      ]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_1)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;
  total_staked += DEFAULT_STAKE_AMOUNT;
  var alice_rewards_per_share = rewards_per_share;
  var alice_tier1_block = current_block;
  alice_pending_rewards +=
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT * BigInt(2))),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: REWARDS + DEFAULT_STAKE_AMOUNT * BigInt(5) },
      ]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "claimRewards",
    funcArgs: [],
  });

  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;
  var alice_rewards =
    alice_pending_rewards +
    (BigInt(rewards_per_share - alice_rewards_per_share) *
      BigInt(DEFAULT_STAKE_AMOUNT * BigInt(2))) /
      BigInt(DIVISION_SAFETY_CONSTANT);
  alice_pending_rewards = 0n;
  alice_rewards_per_share = rewards_per_share;

  assertAccount(await alice.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(2) * BigInt(DEFAULT_STAKE_AMOUNT) +
            alice_rewards,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccount(), {
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT * BigInt(2))),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount: REWARDS + DEFAULT_STAKE_AMOUNT * BigInt(5) - alice_rewards,
        },
      ]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_0)],
  });

  const fees = (DEFAULT_UNSTAKE_AMOUNT * BigInt(380)) / BigInt(10000);
  const alice_unstaked = DEFAULT_UNSTAKE_AMOUNT - fees;
  var alice_amount_staked = DEFAULT_STAKE_AMOUNT * BigInt(2);
  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;
  alice_pending_rewards =
    ((rewards_per_share - alice_rewards_per_share) * alice_amount_staked) /
    BigInt(DIVISION_SAFETY_CONSTANT);
  alice_rewards_per_share = rewards_per_share;
  total_staked -= DEFAULT_UNSTAKE_AMOUNT;
  alice_amount_staked -= DEFAULT_UNSTAKE_AMOUNT;
  alice_tier0_block = current_block;

  assertAccount(await alice.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(2) * BigInt(DEFAULT_STAKE_AMOUNT) +
            alice_rewards +
            alice_unstaked,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccount(), {
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(alice_amount_staked)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS +
            DEFAULT_STAKE_AMOUNT * BigInt(5) -
            alice_rewards -
            alice_unstaked,
        },
      ]),
    ],
  });

  current_block += BLOCK_INCREMENT;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "claimRewards",
    funcArgs: [],
  });

  rewards_per_share +=
    (BigInt(BLOCK_INCREMENT) *
      BigInt(DIVISION_SAFETY_CONSTANT) *
      BigInt(10 ** TOKEN_DECIMALS)) /
    total_staked;

  var bob_rewards =
    (BigInt(rewards_per_share - bob_rewards_per_share) *
      BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);
  bob_rewards_per_share = rewards_per_share;

  assertAccount(await bob.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(DEFAULT_STAKE_AMOUNT) +
            bob_rewards,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccount(), {
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(alice_amount_staked)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS +
            DEFAULT_STAKE_AMOUNT * BigInt(5) -
            alice_rewards -
            alice_unstaked -
            bob_rewards,
        },
      ]),
    ],
  });

  await carol.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "claimRewards",
    funcArgs: [],
  });

  var carol_rewards =
    (BigInt(rewards_per_share - carol_rewards_per_share) *
      BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);
  carol_rewards_per_share = rewards_per_share;

  assertAccount(await carol.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(DEFAULT_STAKE_AMOUNT) +
            carol_rewards,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccount(), {
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(alice_amount_staked)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS +
            DEFAULT_STAKE_AMOUNT * BigInt(5) -
            alice_rewards -
            alice_unstaked -
            bob_rewards -
            carol_rewards,
        },
      ]),
    ],
  });

  await dave.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "claimRewards",
    funcArgs: [],
  });

  var dave_rewards =
    (BigInt(rewards_per_share - dave_rewards_per_share) *
      BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);
  dave_rewards_per_share = rewards_per_share;

  assertAccount(await dave.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(DEFAULT_STAKE_AMOUNT) +
            dave_rewards,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccount(), {
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(alice_amount_staked)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS +
            DEFAULT_STAKE_AMOUNT * BigInt(5) -
            alice_rewards -
            alice_unstaked -
            bob_rewards -
            carol_rewards -
            dave_rewards,
        },
      ]),
    ],
  });

  assertAccount(await alice.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(2) * BigInt(DEFAULT_STAKE_AMOUNT) +
            alice_rewards +
            alice_unstaked,
        },
      ]),
    ],
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "claimRewards",
    funcArgs: [],
  });

  var alice_rewards2 =
    alice_pending_rewards +
    (BigInt(rewards_per_share - alice_rewards_per_share) *
      BigInt(DEFAULT_STAKE_AMOUNT * BigInt(2) - DEFAULT_UNSTAKE_AMOUNT)) /
      BigInt(DIVISION_SAFETY_CONSTANT);
  alice_rewards_per_share = rewards_per_share;
  alice_pending_rewards = 0n;

  assertAccount(await alice.getAccount(), {
    balance: 100_000,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            BigInt(DEFAULT_WALLET_AMOUNT) -
            BigInt(2) * BigInt(DEFAULT_STAKE_AMOUNT) +
            alice_rewards +
            alice_unstaked +
            alice_rewards2,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccount(), {
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(total_staked)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(alice_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(alice_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(alice_amount_staked)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(alice_tier0_block)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(alice_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(bob))
        .Value(e.U(bob_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(bob))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(bob), e.U8(TIER_1))
        .Value(e.U(bob_tier1_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(bob)).Value(e.U(ZERO)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(carol))
        .Value(e.U(carol_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(carol))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(carol), e.U8(TIER_2))
        .Value(e.U(carol_tier2_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(carol)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(dave))
        .Value(e.U(dave_rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(dave))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(dave), e.U8(TIER_0))
        .Value(e.U(dave_tier0_block)),
      e.kvs.Mapper("wallet_pending_rewards", e.Addr(dave)).Value(e.U(ZERO)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS +
            DEFAULT_STAKE_AMOUNT * BigInt(5) -
            alice_rewards -
            alice_unstaked -
            bob_rewards -
            carol_rewards -
            dave_rewards -
            alice_rewards2,
        },
      ]),
    ],
  });
});
