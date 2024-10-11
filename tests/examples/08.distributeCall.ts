import { ContractLoader } from "./ContractLoader";
import {
  privateKeyBob,
  bobAddressBech32,
  deployerAddressBech32,
  POOL_ID,
  TIMESTAMP,
  DATA_DEPLOYER_SIGNED,
  privateKeyDeployer,
} from "./signedData";

import {
  Address,
  TokenTransfer,
  Account,
  U64Value,
  BytesValue,
  Token,
  VariadicValue,
  TokenIdentifierType,
  VariadicType,
  CompositeValue,
  AddressValue,
  U32Value,
} from "@multiversx/sdk-core";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";
const apiNetworkProvider = new ApiNetworkProvider(
  "https://devnet-api.multiversx.com",
);
import axios from "axios";

const POOL_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgqkm8dzcqegmeh0cl40l5afd8pke6qd04g7wpqc7r6xj";

async function callDepositWithAmbassador() {
  const contractLoader = new ContractLoader(
    "../../raise-pool/output/raise-pool.abi.json",
  );
  const contract = await contractLoader.getContract(POOL_CONTRACT_ADDRESS);

  const deployerAsAddress = Address.fromBech32(deployerAddressBech32);
  const deployerAsAccount = new Account(deployerAsAddress);

  const deployerOnNetwork =
    await apiNetworkProvider.getAccount(deployerAsAddress);
  deployerAsAccount.update(deployerOnNetwork);

  const nonce = deployerAsAccount.getNonceThenIncrement().valueOf();

  const transaction = contract.methodsExplicit
    .distribute([
      new U64Value(TIMESTAMP),
      BytesValue.fromHex(DATA_DEPLOYER_SIGNED),
      VariadicValue.fromItems(
        CompositeValue.fromItems(
          new AddressValue(new Address(bobAddressBech32)),
          new U32Value(5000000000000000000n),
        ),
        CompositeValue.fromItems(
          new AddressValue(new Address(deployerAddressBech32)),
          new U32Value(5000000000000000000n),
        ),
      ),
    ])
    .withMultiESDTNFTTransfer([
      new TokenTransfer({
        token: new Token({ identifier: "EGLD-000000" }),
        amount: 100000000000000000n,
      }),
      new TokenTransfer({
        token: new Token({ identifier: "PACTA-e4a9f6" }),
        amount: 10000000000000000000n,
      }),
    ])
    .withSender(new Address(deployerAddressBech32))
    .withGasLimit(50_000_000)
    .withChainID("D")
    .withNonce(nonce)
    .buildTransaction();

  const signature = privateKeyDeployer.sign(transaction.serializeForSigning());
  transaction.applySignature(signature);

  const data = await axios.post(
    "https://devnet-api.multiversx.com/transactions",
    transaction.toSendable(),
  );
  console.log(data);
}

callDepositWithAmbassador().catch(console.error);
