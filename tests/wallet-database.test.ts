import { test, beforeEach, afterEach, expect } from "vitest";
import { e, SContract, SWallet, SWorld } from "xsuite";
import {
  SIGNATURE_DEPLOYER,
  SIGNATURE_BOB,
  SIGNATURE_DUMMY,
  deployerAddress,
  bobAddress,
  bobAddressHex,
} from "./helpers";

let world: SWorld;
let deployer: SWallet;
let contract: SContract;
let bob: SWallet;

beforeEach(async () => {
  world = await SWorld.start();
  await world.setCurrentBlockInfo({
    timestamp: 10,
  });
  world;
  deployer = await world.createWallet({ address: deployerAddress });
  bob = await world.createWallet({ address: bobAddress });

  ({ contract } = await deployer.deployContract({
    code: "file:wallet-database/output/wallet-database.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [e.Addr(deployer)],
  }));
});

afterEach(async () => {
  world.terminate();
});

test("Add wallet", async () => {
  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.TopBuffer(SIGNATURE_BOB), e.TopBuffer(SIGNATURE_DEPLOYER)],
  });
});

test("Add wallet with wrong user signature", async () => {
  await bob
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "registerWallet",
      funcArgs: [e.TopBuffer(SIGNATURE_DUMMY), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Add wallet with wrong signer signature", async () => {
  await bob
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "registerWallet",
      funcArgs: [e.TopBuffer(SIGNATURE_BOB), e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Add wallet twice", async () => {
  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.TopBuffer(SIGNATURE_BOB), e.TopBuffer(SIGNATURE_DEPLOYER)],
  });

  await bob
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "registerWallet",
      funcArgs: [e.TopBuffer(SIGNATURE_BOB), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Wallet is already registered" });
});

test("Remove wallet", async () => {
  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.TopBuffer(SIGNATURE_BOB), e.TopBuffer(SIGNATURE_DEPLOYER)],
  });

  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "removeWallet",
    funcArgs: [e.TopBuffer(SIGNATURE_DEPLOYER)],
  });
});

test("Remove unregistered wallet", async () => {
  await bob
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "removeWallet",
      funcArgs: [e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Wallet is not registered" });
});

test("Remove wallet with wrong signer signature", async () => {
  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.TopBuffer(SIGNATURE_BOB), e.TopBuffer(SIGNATURE_DEPLOYER)],
  });

  await bob
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "removeWallet",
      funcArgs: [e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Set new signer", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "updateSigner",
    funcArgs: [e.Addr(bob)],
  });

  let result = await deployer.query({
    callee: contract,
    funcName: "getSignerAddress",
  });
  // console.log(result);
  expect(result.returnData[0]).toBe(bobAddressHex);
});
