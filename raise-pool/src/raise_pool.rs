#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;

pub const MAX_PERCENTAGE: u64 = 10_000;

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

    #[payable("*")]
    #[endpoint(deposit)]
    fn deposit(
        &self,
        platform_fee_percentage: BigUint,
        group_fee_percentage: BigUint,
        ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>,
    ) {
        let payment = self.call_value().single_esdt();
        require!(
            self.payment_currencies()
                .contains(&payment.token_identifier),
            "Invalid token payment"
        );

        let timestamp = self.blockchain().get_block_timestamp();
        require!(timestamp > self.start_date().get(), "Deposits not open yet");
        require!(timestamp < self.end_date().get(), "Deposits closed");

        require!(
            self.total_amount().get() + &payment.amount <= self.hard_cap().get(),
            "Hard cap threshold would be exceeded"
        );

        require!(
            self.min_deposit().get() <= payment.amount,
            "Payment amount too low"
        );

        require!(
            payment.amount <= self.max_deposit().get(),
            "Payment amount too high"
        );

        require!(
            &payment.amount % &self.deposit_increments().get() == 0,
            "Payment amount is not a multiple of the deposit increment"
        );

        let caller = self.blockchain().get_caller();
        self.addresses().insert(caller.clone());

        self.address_amount(&caller)
            .update(|current| *current += &payment.amount);
        self.total_amount()
            .update(|current| *current += &payment.amount);

        let platform_fee_amount = (&payment.amount * &platform_fee_percentage) / MAX_PERCENTAGE;
        self.address_platform_fee(&caller)
            .update(|current| *current += &platform_fee_amount);
        self.total_platform_fee()
            .update(|current| *current += &platform_fee_amount);

        let group_fee_amount = (&payment.amount * &group_fee_percentage) / MAX_PERCENTAGE;
        self.address_group_fee(&caller)
            .update(|current| *current += &group_fee_amount);
        self.total_group_fee()
            .update(|current| *current += &group_fee_amount);

        match ambassador.into_option() {
            Some(ambassador) => {
                let (amount, wallet) = ambassador.into_tuple();
                let ambassador_amount = (&payment.amount * &amount)  / MAX_PERCENTAGE;
                self.address_ambassador_fee(&caller)
                    .update(|current| *current += &ambassador_amount);
                self.total_ambassador_fee()
                    .update(|current| *current += &ambassador_amount);
                self.ambassador_fee(&wallet)
                    .update(|current| *current += &ambassador_amount);
            }
            None => {}
        }
    }

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

    #[view(getPaymentCurrencies)]
    #[storage_mapper("payment_currencies")]
    fn payment_currencies(&self) -> UnorderedSetMapper<TokenIdentifier>;

    //

    #[view(getAddresses)]
    #[storage_mapper("addresses")]
    fn addresses(&self) -> UnorderedSetMapper<ManagedAddress>;

    #[view(getAddressAmount)]
    #[storage_mapper("address_amount")]
    fn address_amount(&self, address: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getTotalAmount)]
    #[storage_mapper("total_amount")]
    fn total_amount(&self) -> SingleValueMapper<BigUint>;

    #[view(getAddressPlatformFee)]
    #[storage_mapper("address_platform_fee")]
    fn address_platform_fee(&self, address: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getTotalPlatformFee)]
    #[storage_mapper("total_platform_fee")]
    fn total_platform_fee(&self) -> SingleValueMapper<BigUint>;   

    #[view(getAddressGroupFee)]
    #[storage_mapper("address_group_fee")]
    fn address_group_fee(&self, address: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getTotalGroupFee)]
    #[storage_mapper("total_group_fee")]
    fn total_group_fee(&self) -> SingleValueMapper<BigUint>;

    #[view(getAddressAmbassadorFee)]
    #[storage_mapper("address_ambassador_fee")]
    fn address_ambassador_fee(&self, address: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getTotalAmbassadorFee)]
    #[storage_mapper("total_ambassador_fee")]
    fn total_ambassador_fee(&self) -> SingleValueMapper<BigUint>;

    #[view(getAmbassadorFee)]
    #[storage_mapper("ambassador_fee")]
    fn ambassador_fee(&self, ambassador_fee: &ManagedAddress) -> SingleValueMapper<BigUint>;

}
