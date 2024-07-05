#![no_std]

use multiversx_sc::imports::*;
mod helper;
mod storage;
mod wallet_database;
use crate::helper::ALLOWED_TIMESTAMP_DELAY;
use crate::helper::DEFAULT_DECIMALS;
use storage::ReleaseState;

pub const MIN_GAS_FOR_OPERATION: u64 = 2_000_000;
pub const MAX_TX_PER_RELEASE: u32 = 140; // Value in production: 140, value for testing: 10

#[multiversx_sc::contract]
pub trait RaisePool:
    crate::storage::StorageModule + crate::helper::HelperModule + crate::wallet_database::WalletDatabase
{
    #[init]
    fn init(
        &self,
        owner: ManagedAddress,
        pool_id: u32,
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
        signer: ManagedAddress,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
    ) {
        self.validate_init(
            &soft_cap,
            &hard_cap,
            &min_deposit,
            &max_deposit,
            start_date,
            end_date,
            &deposit_increments,
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
        self.raise_pool_enabled().set(false);
        self.signer().set(&signer);
        self.pool_id().set(pool_id);
        self.release_state().set(ReleaseState::None);
        self.owner().set(owner);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[payable("*")]
    #[endpoint(deposit)]
    fn deposit(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
        platform_fee_percentage: BigUint,
        group_fee_percentage: BigUint,
        ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>,
    ) {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();
        let pool_id = self.pool_id().get();

        self.validate_deploy_signature(
            timestamp,
            &pool_id,
            &caller,
            &platform_fee_percentage,
            &group_fee_percentage,
            signer,
            signature,
            ambassador.clone(),
        );

        require!(
            self.whitelisted_wallets().contains(&caller),
            "Wallet not whitelisted"
        );
        let payment = self.call_value().single_esdt();
        self.validate_deposit(&payment, &timestamp);
        self.update_general(&caller, &payment);

        let payment_denomination = self.denominate_payment(&payment);
        require!(
            self.total_amount().get() + &payment_denomination
                <= self.hard_cap().get() * 10_u64.pow(DEFAULT_DECIMALS),
            "Hard cap threshold would be exceeded"
        );

        self.total_amount()
            .update(|current| *current += &payment_denomination);
        self.total_amount_currency(&payment.token_identifier)
            .update(|current| *current += &payment.amount);

        self.update_platform_fee(
            &caller,
            &payment,
            &payment_denomination,
            &platform_fee_percentage,
        );

        self.update_group_fee(
            &caller,
            &payment,
            &payment_denomination,
            &group_fee_percentage,
        );

        match ambassador.into_option() {
            Some(ambassador) => {
                self.update_ambassador_fee(&caller, &payment, ambassador);
            }
            None => {}
        }
    }

    #[endpoint(refund)]
    fn refund(&self, timestamp: u64, signature: ManagedBuffer) -> OperationCompletionStatus {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();
        let pool_id = self.pool_id().get();
        self.validate_signature(timestamp, &pool_id, &caller, signer, signature);
        let caller = self.blockchain().get_caller();
        require!(caller == self.owner().get(), "Only owner can call refund");
        require!(
            timestamp <= self.blockchain().get_block_timestamp(),
            "Timestamp provided by backend set in the future"
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Refund took too long"
        );
        require!(self.refund_enabled().get(), "Refunds are not enabled");
        require!(
            self.blockchain().get_block_timestamp() > self.end_date().get(),
            "Refunds are not open"
        );
        require!(
            self.total_amount().get() < self.soft_cap().get() * 10_u64.pow(DEFAULT_DECIMALS),
            "Soft cap exceeded"
        );

        let addresses = self.addresses();
        let addresses_len = addresses.len();
        let addresses_iter = addresses.iter();
        let mut refund_index = self.refund_index().get();
        let mut addresses_iter = addresses_iter.skip(refund_index);
        let mut tx_index = 0;

        while refund_index < addresses_len {
            if self.blockchain().get_gas_left() < MIN_GAS_FOR_OPERATION
                || tx_index == MAX_TX_PER_RELEASE
            {
                self.refund_index().set(refund_index);
                return OperationCompletionStatus::InterruptedBeforeOutOfGas;
            }

            let address = addresses_iter.next().unwrap();
            let mut payments: ManagedVec<EsdtTokenPayment> = ManagedVec::new();
            for token_identifier in self.deposited_currencies(&address).iter() {
                let amount = self.deposited_amount(&address, &token_identifier).get();
                payments.push(EsdtTokenPayment::new(token_identifier, 0, amount));
            }
            self.send().direct_multi(&address, &payments);
            refund_index += 1;
            tx_index += 1;
        }
        self.refund_index().set(addresses_len);
        OperationCompletionStatus::Completed
    }

    #[endpoint(release)]
    fn release(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
        overcommited: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>,
    ) -> OperationCompletionStatus {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();
        let pool_id = self.pool_id().get();
        self.validate_signature(timestamp, &pool_id, &caller, signer, signature);
        require!(caller == self.owner().get(), "Only owner can call release");
        require!(
            timestamp <= self.blockchain().get_block_timestamp(),
            "Timestamp provided by backend set in the future"
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Release took too long"
        );

        let overcommited_len = overcommited.len();
        loop {
            match self.release_state().get() {
                ReleaseState::None => {
                    self.release_plaform();
                    self.release_state().set(ReleaseState::PlatformReleased);
                }
                ReleaseState::PlatformReleased => {
                    self.release_group();
                    self.release_state().set(ReleaseState::GroupReleased);
                }
                ReleaseState::GroupReleased => {
                    let status = self.release_ambassadors();
                    if status == OperationCompletionStatus::InterruptedBeforeOutOfGas {
                        return status;
                    }
                    self.release_state().set(ReleaseState::AmbassadorsReleased);
                }
                ReleaseState::AmbassadorsReleased => {
                    if overcommited_len > 0 {
                        let status =
                            self.refund_overcommited(overcommited.clone(), overcommited_len);
                        if status == OperationCompletionStatus::InterruptedBeforeOutOfGas {
                            return status;
                        }
                        self.release_state().set(ReleaseState::AllReleased);
                    } else {
                        self.release_state().set(ReleaseState::AllReleased);
                    }
                }
                ReleaseState::AllReleased => return OperationCompletionStatus::Completed,
            }
        }
    }

    #[endpoint(retrieve)]
    fn retrieve(&self, timestamp: u64, signature: ManagedBuffer) {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();
        let pool_id = self.pool_id().get();
        self.validate_signature(timestamp, &pool_id, &caller, signer, signature);
        require!(caller == self.owner().get(), "Only owner can call retrieve");
        require!(
            timestamp <= self.blockchain().get_block_timestamp(),
            "Timestamp provided by backend set in the future"
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Retrieve took too long"
        );
        require!(
            self.release_state().get() == ReleaseState::AllReleased,
            "Release needs to be called first"
        );

        let mut payments = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            let amount = self.total_amount_currency(&token).get();
            if amount > 0 {
                payments.push(EsdtTokenPayment::new(token.clone(), 0, amount));
            }
        }
        self.send().direct_multi(&caller, &payments);
        for payment in &payments {
            self.decrease_totals(payment.token_identifier, payment.amount);
        }
    }

    fn release_plaform(&self) {
        let mut payments = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            let fee = self.platform_fee(&token).get();
            if fee > 0 {
                payments.push(EsdtTokenPayment::new(token, 0, fee));
            }
        }
        self.send()
            .direct_multi(&self.platform_fee_wallet().get(), &payments);
        for payment in &payments {
            self.decrease_totals(payment.token_identifier, payment.amount);
        }
    }

    fn release_group(&self) {
        let mut payments = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            let fee = self.group_fee(&token).get();
            if fee > 0 {
                payments.push(EsdtTokenPayment::new(token.clone(), 0, fee));
            }
        }
        self.send()
            .direct_multi(&self.group_fee_wallet().get(), &payments);
        for payment in &payments {
            self.decrease_totals(payment.token_identifier, payment.amount);
        }
    }

    fn release_ambassadors(&self) -> OperationCompletionStatus {
        let ambassadors = self.ambassadors();
        let ambassadors_len = ambassadors.len();
        let ambassadors_iter = ambassadors.into_iter();
        let mut release_ambassador_index = self.release_ambassador_index().get();
        let mut ambassadors_iter = ambassadors_iter.skip(release_ambassador_index);
        let mut tx_index = 0;

        while release_ambassador_index < ambassadors_len {
            if self.blockchain().get_gas_left() < MIN_GAS_FOR_OPERATION
                || tx_index == MAX_TX_PER_RELEASE
            {
                self.release_ambassador_index()
                    .set(release_ambassador_index);
                return OperationCompletionStatus::InterruptedBeforeOutOfGas;
            }
            let ambassador = ambassadors_iter.next().unwrap();
            let mut payments: ManagedVec<EsdtTokenPayment> = ManagedVec::new();
            for token_identifier in self.ambassador_currencies(&ambassador).iter() {
                let amount = self
                    .referral_ambassador_fee(&ambassador, &token_identifier)
                    .get();
                payments.push(EsdtTokenPayment::new(
                    token_identifier.clone(),
                    0,
                    amount.clone(),
                ));
            }
            self.send().direct_multi(&ambassador, &payments);
            for payment in &payments {
                self.decrease_totals(payment.token_identifier, payment.amount);
            }
            release_ambassador_index += 1;
            tx_index += 1;
        }

        self.release_ambassador_index().set(ambassadors_len);
        OperationCompletionStatus::Completed
    }

    fn refund_overcommited(
        &self,
        overcommited: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>,
        overcommited_len: usize,
    ) -> OperationCompletionStatus {
        let overcommited_iter = overcommited.into_iter();
        let mut overcommited_index = self.overcommited_index().get();
        let mut overcommited_iter = overcommited_iter.skip(overcommited_index);
        let mut tx_index: usize = 0;

        while overcommited_index < overcommited_len {
            if self.blockchain().get_gas_left() < MIN_GAS_FOR_OPERATION
                || tx_index == MAX_TX_PER_RELEASE as usize
            {
                self.overcommited_index().set(overcommited_index);
                return OperationCompletionStatus::InterruptedBeforeOutOfGas;
            }
            let overcommitment_data = overcommited_iter.next().unwrap();
            let (overcommiter, token_identifier, amount) = overcommitment_data.into_tuple();
            self.send()
                .direct_esdt(&overcommiter, &token_identifier, 0, &amount);

            self.deposited_amount(&overcommiter, &token_identifier)
                .update(|current| *current -= &amount);
            self.decrease_totals(token_identifier, amount);

            overcommited_index += 1;
            tx_index += 1;
        }

        self.overcommited_index().set(overcommited_len);
        OperationCompletionStatus::Completed
    }
}
