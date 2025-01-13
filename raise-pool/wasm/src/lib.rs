// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Upgrade:                              1
// Endpoints:                           49
// Async Callback (empty):               1
// Total number of exported functions:  52

#![no_std]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    raise_pool
    (
        init => init
        upgrade => upgrade
        deposit => deposit
        refund => refund
        release => release
        userRefund => user_refund
        adminRefund => admin_refund
        setPlatformFeeWallet => set_platform_fee_wallet
        enableRaisePool => enable_raise_pool
        setTimestamps => set_timestamps
        setRefundEnabled => set_refund_enabled
        getPoolId => pool_id
        getSoftCap => soft_cap
        getHardCap => hard_cap
        getMinDeposit => min_deposit
        getMaxDeposit => max_deposit
        getDepositIncrements => deposit_increments
        getStartDate => start_date
        getEndDate => end_date
        getRefundEnabled => refund_enabled
        getRefundDeadline => refund_deadline
        getPlatfromFeeWallet => platform_fee_wallet
        getGroupFeeWallet => group_fee_wallet
        getPaymentCurrencies => payment_currencies
        getCurrencyDecimals => currency_decimals
        getWallatDatabaseAddress => wallet_database_address
        getSigner => signer
        getAddresses => addresses
        getRefundIndex => refund_index
        getDepositedCurrencies => deposited_currencies
        getDepositedAmount => deposited_amount
        getTotalAmount => total_amount
        getTotalAmountCurrency => total_amount_currency
        getAddressPlatformFee => address_platform_fee
        getPlatformFee => platform_fee
        getTotalPlatformFee => total_platform_fee
        getAddressGroupFee => address_group_fee
        getGroupFee => group_fee
        getTotalGroupFee => total_group_fee
        getAmbassadors => ambassadors
        getReleaseAmbassadorIndex => release_ambassador_index
        getAddressAmbassadorFee => address_ambassador_fee
        getAmbassadorFee => ambassador_fee
        getTotalAmbassadorFee => total_ambassador_fee
        getAmbassadorCurrencies => ambassador_currencies
        getReferralAmbassadorFee => referral_ambassador_fee
        getAddressToAmbassador => address_to_ambassadors
        getOvercommitedIndex => overcommited_index
        getReleaseState => release_state
        raisePoolEnabled => raise_pool_enabled
        getOwner => owner
    )
}

multiversx_sc_wasm_adapter::async_callback_empty! {}
