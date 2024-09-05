## Owner Callable Endpoints on Raise Pool SC:

- **refund** (_timestamp: u64, signature: ManagedBuffer_) -> _OperationCompletionStatus_

  - This endpoint refunds the deposited amounts to users if the Soft Cap is not exceeded once the End Date is exceeded.
  - If there are more transactions than the blockchain limit, the function returns _interrupted_, so this endpoint needs to be called again. Otherwise, it returns _completed_.
  - Signature data format: signed(timestamp + pool_id + deployer_address).

- **release** (_timestamp: u64, signature: ManagedBuffer, overcommitted: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>_) -> _OperationCompletionStatus_

  - Once the End Date is exceeded, calling the release endpoint sends fees to the Platform, Group, and Ambassador Wallets (and potentially to Overcommitter Wallets if applicable).
  - If there are more transactions than the blockchain limit, the function returns _interrupted_, so this endpoint needs to be called again. Otherwise, it returns _completed_. Please keep in mind that if the function returns _interrupted_, the next call needs to have the exact same parameters (so even if the function reaches the _overcommited_ step and returns _interrupted_, the next call needs to have the original overcommited list as parameter)
  - Signature data format: signed(timestamp + pool_id + deployer_address).

- **retrieve** (_timestamp: u64, signature: ManagedBuffer_)

  - Once the _release_ has been completed, calling this endpoint sends the remaining deposited funds to the owner wallet.
  - Signature data format: signed(timestamp + pool_id + deployer_address).


## User Callable Endpoints on Raise Pool SC:

- **deposit** (_timestamp: u64, signature: ManagedBuffer, platform_fee_percentage: BigUint, group_fee_percentage: BigUint, ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>_)

  - This is the main endpoint of the pool, used to deposit tokens in the pool.
  - If no ambassador is provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee_percentage + group_fee_percentage).
  - If an ambassador is provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee_percentage + group_fee_percentage + ambassador_fee + ambassador_address).
