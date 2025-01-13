multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[derive(TopEncode, TopDecode, PartialEq, TypeAbi, Clone, Copy, Debug)]
pub enum ReleaseState {
    None,
    OvercommitersReleased,
    PlatformReleased,
    GroupReleased,
    AllReleased,
    Retrieved,
}

#[multiversx_sc::module]
pub trait StorageModule {
    #[view(getPoolId)]
    #[storage_mapper("pool_id")]
    fn pool_id(&self) -> SingleValueMapper<ManagedBuffer>;

    #[view(getSoftCap)]
    #[storage_mapper("soft_cap")]
    fn soft_cap(&self) -> SingleValueMapper<BigUint>;

    #[view(getHardCap)]
    #[storage_mapper("hard_cap")]
    fn hard_cap(&self) -> SingleValueMapper<BigUint>;

    #[view(getMinDeposit)]
    #[storage_mapper("min_deposit")]
    fn min_deposit(&self) -> SingleValueMapper<BigUint>;

    #[view(getMaxDeposit)]
    #[storage_mapper("max_deposit")]
    fn max_deposit(&self) -> SingleValueMapper<BigUint>;

    #[view(getDepositIncrements)]
    #[storage_mapper("deposit_increments")]
    fn deposit_increments(&self) -> SingleValueMapper<BigUint>;

    #[view(getStartDate)]
    #[storage_mapper("start_date")]
    fn start_date(&self) -> SingleValueMapper<u64>;

    #[view(getEndDate)]
    #[storage_mapper("end_date")]
    fn end_date(&self) -> SingleValueMapper<u64>;

    #[view(getRefundEnabled)]
    #[storage_mapper("refund_enabled")]
    fn refund_enabled(&self) -> SingleValueMapper<bool>;

    #[view(getRefundDeadline)]
    #[storage_mapper("refund_deadline")]
    fn refund_deadline(&self) -> SingleValueMapper<u64>;

    #[view(getPlatfromFeeWallet)]
    #[storage_mapper("platform_fee_wallet")]
    fn platform_fee_wallet(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getGroupFeeWallet)]
    #[storage_mapper("group_fee_wallet")]
    fn group_fee_wallet(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getPaymentCurrencies)]
    #[storage_mapper("payment_currencies")]
    fn payment_currencies(&self) -> UnorderedSetMapper<TokenIdentifier>;

    #[view(getCurrencyDecimals)]
    #[storage_mapper("currency_decimals")]
    fn currency_decimals(&self, currency: &TokenIdentifier) -> SingleValueMapper<u32>;

    #[view(getWallatDatabaseAddress)]
    #[storage_mapper("wallet_database_address")]
    fn wallet_database_address(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getSigner)]
    #[storage_mapper("signer")]
    fn signer(&self) -> SingleValueMapper<ManagedAddress>;

    //

    #[view(getAddresses)]
    #[storage_mapper("addresses")]
    fn addresses(&self) -> UnorderedSetMapper<ManagedAddress>;

    #[view(getRefundIndex)]
    #[storage_mapper("refund_index")]
    fn refund_index(&self) -> SingleValueMapper<usize>;

    #[view(getDepositedCurrencies)]
    #[storage_mapper("deposited_currencies")]
    fn deposited_currencies(&self, address: &ManagedAddress)
        -> UnorderedSetMapper<TokenIdentifier>;

    #[view(getDepositedAmount)]
    #[storage_mapper("deposited_amount")]
    fn deposited_amount(
        &self,
        address: &ManagedAddress,
        currency: &TokenIdentifier,
    ) -> SingleValueMapper<BigUint>;

    #[view(getTotalAmount)]
    #[storage_mapper("total_amount")]
    fn total_amount(&self) -> SingleValueMapper<BigUint>;

    #[view(getTotalAmountCurrency)]
    #[storage_mapper("total_amount_currency")]
    fn total_amount_currency(&self, currency: &TokenIdentifier) -> SingleValueMapper<BigUint>;

    #[view(getAddressPlatformFee)]
    #[storage_mapper("address_platform_fee")]
    fn address_platform_fee(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
    ) -> SingleValueMapper<BigUint>;

    #[view(getPlatformFee)]
    #[storage_mapper("platform_fee")]
    fn platform_fee(&self, token: &TokenIdentifier) -> SingleValueMapper<BigUint>;

    #[view(getTotalPlatformFee)]
    #[storage_mapper("total_platform_fee")]
    fn total_platform_fee(&self) -> SingleValueMapper<BigUint>;

    #[view(getAddressGroupFee)]
    #[storage_mapper("address_group_fee")]
    fn address_group_fee(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
    ) -> SingleValueMapper<BigUint>;

    #[view(getGroupFee)]
    #[storage_mapper("group_fee")]
    fn group_fee(&self, token: &TokenIdentifier) -> SingleValueMapper<BigUint>;

    #[view(getTotalGroupFee)]
    #[storage_mapper("total_group_fee")]
    fn total_group_fee(&self) -> SingleValueMapper<BigUint>;

    #[view(getAmbassadors)]
    #[storage_mapper("ambassadors")]
    fn ambassadors(&self) -> UnorderedSetMapper<ManagedAddress>;

    #[view(getReleaseAmbassadorIndex)]
    #[storage_mapper("release_ambassador_index")]
    fn release_ambassador_index(&self) -> SingleValueMapper<usize>;

    #[view(getAddressAmbassadorFee)]
    #[storage_mapper("address_ambassador_fee")]
    fn address_ambassador_fee(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
    ) -> SingleValueMapper<BigUint>;

    #[view(getAmbassadorFee)]
    #[storage_mapper("ambassador_fee")]
    fn ambassador_fee(&self, token: &TokenIdentifier) -> SingleValueMapper<BigUint>;

    #[view(getTotalAmbassadorFee)]
    #[storage_mapper("total_ambassador_fee")]
    fn total_ambassador_fee(&self) -> SingleValueMapper<BigUint>;

    #[view(getAmbassadorCurrencies)]
    #[storage_mapper("ambassador_currencies")]
    fn ambassador_currencies(
        &self,
        ambassador: &ManagedAddress,
    ) -> UnorderedSetMapper<TokenIdentifier>;

    #[view(getReferralAmbassadorFee)]
    #[storage_mapper("referral_ambassador_fee")]
    fn referral_ambassador_fee(
        &self,
        ambassador: &ManagedAddress,
        token: &TokenIdentifier,
    ) -> SingleValueMapper<BigUint>;

    #[view(getAddressToAmbassador)]
    #[storage_mapper("address_to_ambassadors")]
    fn address_to_ambassadors(
        &self,
        address: &ManagedAddress,
    ) -> UnorderedSetMapper<ManagedAddress>;

    #[view(getOvercommitedIndex)]
    #[storage_mapper("overcommited_index")]
    fn overcommited_index(&self) -> SingleValueMapper<usize>;

    #[view(getReleaseState)]
    #[storage_mapper("release_state")]
    fn release_state(&self) -> SingleValueMapper<ReleaseState>;

    #[view(raisePoolEnabled)]
    #[storage_mapper("raise_pool_enabled")]
    fn raise_pool_enabled(&self) -> SingleValueMapper<bool>;

    #[view(getOwner)]
    #[storage_mapper("owner")]
    fn owner(&self) -> SingleValueMapper<ManagedAddress>;
}
