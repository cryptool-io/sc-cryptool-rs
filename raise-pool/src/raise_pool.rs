#![no_std]

use multiversx_sc::imports::*;
mod storage;

pub const MAX_PERCENTAGE: u64 = 10_000;
pub const DEFAULT_DECIMALS: u32 = 18;
pub const BULK_BATCH: usize = 100;

/// An empty contract. To be used as a template when starting a new contract from scratch.
#[multiversx_sc::contract]
pub trait RaisePool: crate::storage::StorageModule {
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
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
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
        for payment_currency in payment_currencies {
            let (currency, decimals) = payment_currency.into_tuple();
            self.payment_currencies().insert(currency.clone());
            self.currency_decimals(&currency).set(decimals);
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
        self.addresses().push(&caller.clone());
        self.deposited_currencies(&caller)
            .insert(payment.token_identifier.clone());
        self.deposited_amount(&caller, &payment.token_identifier)
            .update(|current| *current += &payment.amount);
        let payment_denomination = match self.currency_decimals(&payment.token_identifier).get() {
            decimals if decimals != DEFAULT_DECIMALS => {
                &payment.amount * 10_u64.pow(DEFAULT_DECIMALS - decimals)
            }
            _ => payment.amount.clone(),
        };
        self.total_amount()
            .update(|current| *current += &payment_denomination);

        let platform_fee_amount = (&payment.amount * &platform_fee_percentage) / MAX_PERCENTAGE;
        let denominated_platform_fee_amount =
            (&payment_denomination * &platform_fee_percentage) / MAX_PERCENTAGE;

        self.address_platform_fee(&caller, &payment.token_identifier)
            .update(|current| *current += &platform_fee_amount);
        self.platform_fee(&payment.token_identifier)
            .update(|current| *current += &platform_fee_amount);
        self.total_platform_fee()
            .update(|current| *current += &denominated_platform_fee_amount);

        let group_fee_amount = (&payment.amount * &group_fee_percentage) / MAX_PERCENTAGE;
        let denominated_group_fee_amount =
            (&payment_denomination * &group_fee_percentage) / MAX_PERCENTAGE;
        self.address_group_fee(&caller, &payment.token_identifier)
            .update(|current| *current += &group_fee_amount);
        self.group_fee(&payment.token_identifier)
            .update(|current| *current += &group_fee_amount);
        self.total_group_fee()
            .update(|current| *current += &denominated_group_fee_amount);

        match ambassador.into_option() {
            Some(ambassador) => {
                let (ambassador_percentage, ambassador_wallet) = ambassador.into_tuple();
                self.ambassadors().push(&ambassador_wallet);
                let ambassador_amount = (&payment.amount * &ambassador_percentage) / MAX_PERCENTAGE;
                let denominated_ambassador_amount =
                    (&payment_denomination * &ambassador_percentage) / MAX_PERCENTAGE;
                self.address_ambassador_fee(&caller, &payment.token_identifier)
                    .update(|current| *current += &ambassador_amount);
                self.ambassador_fee(&payment.token_identifier)
                    .update(|current| *current += &ambassador_amount);
                self.total_ambassador_fee()
                    .update(|current| *current += &denominated_ambassador_amount);
                self.referral_ambassador_fee(&ambassador_wallet, &payment.token_identifier)
                    .update(|current| *current += &ambassador_amount);
                self.ambassador_currencies(&ambassador_wallet)
                    .insert(payment.token_identifier);
            }
            None => {}
        }
    }

    #[only_owner]
    #[endpoint(refund)]
    fn refund(&self) {
        require!(self.refund_enabled().get(), "Refunds are not enabled");
        require!(
            self.blockchain().get_block_timestamp() > self.end_date().get(),
            "Refunds are not open"
        );
        require!(
            self.total_amount().get() < self.hard_cap().get(),
            "Soft cap exceeded"
        );

        let addresses_len = self.addresses().len();
        let mut refund_index = self.refund_index().get();
        while refund_index < addresses_len {
            let start_index = refund_index + 1;
            let end_index = (start_index + BULK_BATCH).min(addresses_len + 1);
            for idx in start_index..end_index {
                let address = self.addresses().get(idx);
                let mut payments = ManagedVec::new();
                for token_identifier in self.deposited_currencies(&address).iter() {
                    let amount = self.deposited_amount(&address, &token_identifier).get();
                    payments.push(EsdtTokenPayment::new(token_identifier, 0, amount));
                }
                self.send().direct_multi(&address, &payments);
            }
            refund_index = end_index;
            self.refund_index().set(refund_index);
        }
    }

    #[only_owner]
    #[endpoint(release_plaform_and_group)]
    fn release_plaform_and_group(&self) {
        let mut payments = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            payments.push(EsdtTokenPayment::new(
                token.clone(),
                0,
                self.platform_fee(&token).get(),
            ));
        }
        self.send()
            .direct_multi(&self.platform_fee_wallet().get(), &payments);

        let mut payments = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            payments.push(EsdtTokenPayment::new(
                token.clone(),
                0,
                self.group_fee(&token).get(),
            ));
        }
        self.send()
            .direct_multi(&self.group_fee_wallet().get(), &payments);
    }

    #[only_owner]
    #[endpoint(release_ambassadors)]
    fn release_ambassadors(&self) {
        let ambassadors_len = self.ambassadors().len();
        let mut release_index = self.release_index().get();
        while release_index < ambassadors_len {
            let start_index = release_index + 1;
            let end_index = (start_index + BULK_BATCH).min(ambassadors_len + 1);
            for idx in start_index..end_index {
                let ambassador = self.ambassadors().get(idx);
                let mut payments = ManagedVec::new();
                for token_identifier in self.ambassador_currencies(&ambassador).iter() {
                    let amount = self.referral_ambassador_fee(&ambassador, &token_identifier).get();
                    payments.push(EsdtTokenPayment::new(token_identifier, 0, amount));
                }
                self.send().direct_multi(&ambassador, &payments);
            }
            release_index = end_index;
            self.release_index().set(release_index);
        }
    }

    #[only_owner]
    #[endpoint(refund_overcommited)]
    fn refund_overcommited(&self, overcommited: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>) {
        for overcommited in overcommited {
            let (address, token_identifier, amount) = overcommited.into_tuple();
            self.send().direct_esdt(&address, &token_identifier, 0, &amount);
        }
    }

}
