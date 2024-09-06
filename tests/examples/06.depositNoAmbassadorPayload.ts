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
} from "@multiversx/sdk-core";

import {
  TIMESTAMP,
  PLATFORM_FEE,
  GROUP_FEE,
  SIGNATURE_DEPLOY_BOB_WALLET_NO_AMBASSADOR,
} from "./signedData";

function getTransactionPayloadNoAmbassador() {
  const transactionPayload = [
    new U64Value(TIMESTAMP),
    BytesValue.fromHex(SIGNATURE_DEPLOY_BOB_WALLET_NO_AMBASSADOR),
    new BigUIntValue(PLATFORM_FEE),
    new BigUIntValue(GROUP_FEE),
  ];
  return transactionPayload;
}

export { getTransactionPayloadNoAmbassador };
