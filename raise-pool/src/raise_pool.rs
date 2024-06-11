#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;

/// An empty contract. To be used as a template when starting a new contract from scratch.
#[multiversx_sc::contract]
pub trait RaisePool {
    #[init]
    fn init(
        &self,
        soft_cap: BigUint,
        hard_cap: BigUint,
        min_deposit: BigUint,
        max_deposit: BigUint,
        deposit_increments: BigUint,
        start_date: u64,
        end_date: u64,
        refund_enabled: bool,
        platform_fee_wallet: ManagedAddress,
        group_fee_wallet: ManagedAddress,
        signer_address: ManagedAddress,
        payment_currencies: MultiValueEncoded<TokenIdentifier>,
    ) {
        require!(
            soft_cap <= hard_cap,
            "Soft cap needs to be lower than hard cap"
        );

        require!(
            min_deposit <= max_deposit,
            "Minimum deposit amount needs to be lower than maximum deposit amount"
        );

        require!(
            start_date > self.blockchain().get_block_timestamp(),
            "Start date timestamp must be in the future"
        );

        require!(
            end_date > start_date,
            "End date timestamp must be greater than sale end timestamp"
        );

        require!(
            payment_currencies.len() >= 1,
            "Need to provide at least one currency"
        );

        self.soft_cap().set(soft_cap);
        self.hard_cap().set(hard_cap);
        self.min_deposit().set(min_deposit);
        self.max_deposit().set(max_deposit);
        self.deposit_increments().set(deposit_increments);
        self.start_date().set(start_date);
        self.end_date().set(end_date);
        self.refund_enabled().set(refund_enabled);
        self.platform_fee_wallet().set(platform_fee_wallet);
        self.group_fee_wallet().set(group_fee_wallet);
        self.signer_address().set(signer_address);
        for payment_currency in payment_currencies {
            self.payment_currencies().insert(payment_currency);
        }
    }

    #[upgrade]
    fn upgrade(&self) {}

    // STORAGE

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

    #[view(getPlatfromFeeWallet)]
    #[storage_mapper("platform_fee_wallet")]
    fn platform_fee_wallet(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getGroupFeeWallet)]
    #[storage_mapper("group_fee_wallet")]
    fn group_fee_wallet(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getSignerAddress)]
    #[storage_mapper("signer_address")]
    fn signer_address(&self) -> SingleValueMapper<ManagedAddress>;

    #[storage_mapper("payment_currencies")]
    fn payment_currencies(&self) -> UnorderedSetMapper<TokenIdentifier>;
}
