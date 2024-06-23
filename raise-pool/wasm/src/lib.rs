// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Upgrade:                              1
// Endpoints:                           40
// Async Callback (empty):               1
// Total number of exported functions:  43

#![no_std]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    raise_pool
    (
        init => init
        upgrade => upgrade
        enableRaisePool => enable_raise_pool
        deposit => deposit
        refund => refund
        release_plaform => release_plaform
        release => release
        getPoolId => pool_id
        getSoftCap => soft_cap
        getHardCap => hard_cap
        getMinDeposit => min_deposit
        getMaxDeposit => max_deposit
        getDepositIncrements => deposit_increments
        getStartDate => start_date
        getEndDate => end_date
        getRefundEnabled => refund_enabled
        getPlatfromFeeWallet => platform_fee_wallet
        getGroupFeeWallet => group_fee_wallet
        getPaymentCurrencies => payment_currencies
        getCurrencyDecimals => currency_decimals
        getAddresses => addresses
        getRefundIndex => refund_index
        getDepositedCurrencies => deposited_currencies
        getDepositedAmount => deposited_amount
        getTotalAmount => total_amount
        getAddressPlatformFee => address_platform_fee
        getPlatformFee => platform_fee
        getTotalPlatformFee => total_platform_fee
        getAddressGroupFee => address_group_fee
        getGroupFee => group_fee
        getTotalGroupFee => total_group_fee
        getAmbassadors => ambassadors
        getReleaseIndex => release_index
        getAddressAmbassadorFee => address_ambassador_fee
        getAmbassadorFee => ambassador_fee
        getTotalAmbassadorFee => total_ambassador_fee
        getAmbassadorCurrencies => ambassador_currencies
        getReferralAmbassadorFee => referral_ambassador_fee
        getOvercommitedIndex => overcommited_index
        getReleaseState => release_state
        raisePoolEnabled => raise_pool_enabled
        getSigner => signer
    )
}

multiversx_sc_wasm_adapter::async_callback_empty! {}
