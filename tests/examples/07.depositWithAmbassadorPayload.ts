import {
  U32Value,
  U64Value,
  BigUIntValue,
  BooleanValue,
  AddressValue,
  Address,
  BytesValue,
  TokenIdentifierValue,
  VariadicValue,
  TokenIdentifierType,
  VariadicType,
  OptionValue,
  CompositeValue,
  CompositeType,
  OptionalValue,
} from "@multiversx/sdk-core";

import {
  TIMESTAMP,
  PLATFORM_FEE,
  GROUP_FEE,
  AMBASSADOR_FEE,
  AMOUNT,
  deployerAddressBech32,
  SIGNATURE_DEPLOY_BOB_WALLET_WITH_AMBASSADOR,
} from "./signedData";

function getTransactionPayloadWithAmbassador() {
  const transactionPayload = [
    new U64Value(TIMESTAMP),
    BytesValue.fromHex(SIGNATURE_DEPLOY_BOB_WALLET_WITH_AMBASSADOR),
    new BigUIntValue(PLATFORM_FEE),
    new BigUIntValue(GROUP_FEE),
    new OptionalValue(
      new CompositeType(),
      CompositeValue.fromItems(
        new BigUIntValue(AMBASSADOR_FEE),
        new AddressValue(new Address(deployerAddressBech32)),
      ),
    ),
  ];
  return transactionPayload;
}

export { getTransactionPayloadWithAmbassador };
