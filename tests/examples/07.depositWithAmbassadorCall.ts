import { ContractLoader } from "./ContractLoader";
import { getTransactionPayloadWithAmbassador } from "./07.depositWithAmbassadorPayload";
import { privateKeyBob, bobAddressBech32 } from "./signedData";
import { Address, TokenTransfer, Account } from "@multiversx/sdk-core";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";
const apiNetworkProvider = new ApiNetworkProvider(
  "https://devnet-api.multiversx.com",
);
import axios from "axios";
import { AMOUNT } from "./signedData";

const POOL_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgqyt6u26apdyfcefjugyt365v8dg392yfv7wpqzctdmk";

async function callDepositWithAmbassador() {
  const transactionPayload = getTransactionPayloadWithAmbassador();

  const contractLoader = new ContractLoader(
    "../../raise-pool/output/raise-pool.abi.json",
  );
  const contract = await contractLoader.getContract(POOL_CONTRACT_ADDRESS);

  const bobAsAddress = Address.fromBech32(bobAddressBech32);
  const bobAsAccount = new Account(bobAsAddress);

  const deployerOnNetwork = await apiNetworkProvider.getAccount(bobAsAddress);
  bobAsAccount.update(deployerOnNetwork);

  const nonce = bobAsAccount.getNonceThenIncrement().valueOf();

  const transaction = contract.methods
    .deposit(transactionPayload)
    .withGasLimit(50_000_000)
    .withChainID("D")
    .withSender(new Address(bobAddressBech32))
    .withNonce(nonce)
    .withSingleESDTTransfer(
      TokenTransfer.fungibleFromBigInteger("USDC-350c4e", AMOUNT),
    )
    .buildTransaction();

  const signature = privateKeyBob.sign(transaction.serializeForSigning());
  transaction.applySignature(signature);

  const data = await axios.post(
    "https://devnet-api.multiversx.com/transactions",
    transaction.toSendable(),
  );
  console.log(data);
}

callDepositWithAmbassador().catch(console.error);
