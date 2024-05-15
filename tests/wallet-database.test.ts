import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, e, SContract, SWallet, SWorld } from "xsuite";
import { ALICE_ADDRESS, USER_SIGNATURE } from "./helpers";

let world: SWorld;
let deployer: SWallet;
let contract: SContract;
let alice: SWallet;
let bob: SWallet;

beforeEach(async () => {
  world = await SWorld.start();
  await world.setCurrentBlockInfo({
    timestamp: 10,
  });
  world;
  deployer = await world.createWallet();
  alice = await world.createWallet({
    balance: 100_000,
  });

  ({ contract } = await deployer.deployContract({
    code: "file:wallet-database/output/wallet-database.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [e.Addr(ALICE_ADDRESS)],
  }));
});

afterEach(async () => {
  world.terminate();
});

test("TestUserSignature", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.Buffer(USER_SIGNATURE)],
  });
});
