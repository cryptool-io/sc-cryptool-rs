#![no_std]

use multiversx_sc::imports::*;
pub mod events;
pub mod helper;
pub mod storage;
use crate::helper::DEFAULT_DECIMALS;
use storage::ReleaseState;

pub const MIN_GAS_FOR_OPERATION: u64 = 2_000_000;
pub const MAX_TX_PER_RELEASE: u32 = 140;

#[multiversx_sc::contract]
pub trait RaisePool:
    crate::storage::StorageModule + crate::helper::HelperModule + events::EventsModule
{
    #[init]
    fn init(
        &self,
        owner: ManagedAddress,
        pool_id: ManagedBuffer,
        soft_cap: BigUint,
        hard_cap: BigUint,
        min_deposit: BigUint,
        max_deposit: BigUint,
        deposit_increments: BigUint,
        start_date: u64,
        end_date: u64,
        refund_enabled: bool,
        refund_deadline: u64,
        platform_fee_wallet: ManagedAddress,
        group_fee_wallet: ManagedAddress,
        signer: ManagedAddress,
        wallet_database_address: ManagedAddress,
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
        self.refund_deadline().set(refund_deadline);
        self.platform_fee_wallet().set(platform_fee_wallet);
        self.group_fee_wallet().set(group_fee_wallet);
        for payment_currency in payment_currencies {
            let (currency, decimals) = payment_currency.into_tuple();
            self.payment_currencies().insert(currency.clone());
            self.currency_decimals(&currency).set(decimals);
        }
        self.raise_pool_enabled().set(true);
        self.wallet_database_address().set(wallet_database_address);
        self.signer().set(signer);
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
        platform_fee: BigUint,
        group_fee: BigUint,
        deposit_id: ManagedBuffer,
        ambassadors: MultiValueEncoded<MultiValue2<BigUint, ManagedAddress>>,
    ) {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();

        self.validate_deposit_signature(
            timestamp,
            &self.pool_id().get(),
            &caller,
            &platform_fee,
            &group_fee,
            signer,
            signature,
            ambassadors.clone(),
        );

        require!(self.is_registered(&caller), "Wallet not registered");
        require!(
            ambassadors.len() <= 2,
            "Cannot have more than 2 ambassadors"
        );
        require!(platform_fee > 0, "Platform fee cannot be zero");
        require!(group_fee > 0, "Group fee cannot be zero");

        let payment = self.call_value().single_esdt();
        self.validate_deposit(&payment, &timestamp);

        self.increase_general(&caller, &payment);
        self.increase_totals(&payment.token_identifier, &payment.amount);
        self.increase_platform_fee(&caller, &payment.token_identifier, &platform_fee);
        self.increase_group_fee(&caller, &payment.token_identifier, &group_fee);

        let mut total_fees = platform_fee.clone() + group_fee.clone();

        let mut user_ambassador_fee: Option<BigUint> = None;
        let mut user_ambassador: Option<ManagedAddress> = None;
        let mut group_ambassador_fee: Option<BigUint> = None;
        let mut group_ambassador: Option<ManagedAddress> = None;

        for (index, ambassador) in ambassadors.into_iter().enumerate() {
            let (ambassador_amount, ambassador_wallet) = ambassador.into_tuple();
            self.increase_ambassador_fee(
                &caller,
                &payment.token_identifier,
                &ambassador_amount,
                &ambassador_wallet,
            );
            total_fees += &ambassador_amount;
            if index == 0 {
                user_ambassador_fee = Some(ambassador_amount);
                user_ambassador = Some(ambassador_wallet);
            } else if index == 1 {
                group_ambassador_fee = Some(ambassador_amount);
                group_ambassador = Some(ambassador_wallet);
            }
        }

        require!(
            self.total_amount().get()
                - self.total_ambassador_fee().get()
                - self.total_group_fee().get()
                - self.total_platform_fee().get()
                <= self.hard_cap().get() * 10_u64.pow(DEFAULT_DECIMALS),
            "Hard cap threshold would be exceeded"
        );

        let max_deposit_denominated = self.match_denomination(self.max_deposit().get(), &payment);
        require!(
            payment.amount.clone() - total_fees <= max_deposit_denominated,
            "Payment amount too high"
        );

        self.deposited_event(
            self.pool_id().get(),
            deposit_id,
            caller,
            payment.token_identifier,
            payment.amount,
            platform_fee,
            group_fee,
            user_ambassador_fee,
            user_ambassador,
            group_ambassador_fee,
            group_ambassador,
        );
    }

    #[endpoint(refund)]
    fn refund(&self, timestamp: u64, signature: ManagedBuffer) -> OperationCompletionStatus {
        self.validate_owner_call_on_enabled_pool(timestamp, signature);
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

            let address = addresses_iter.next().clone().unwrap();
            let mut payments: ManagedVec<EsdtTokenPayment> = ManagedVec::new();
            for token_identifier in self.deposited_currencies(&address).iter() {
                let payment = self.release_token_admin(&address, &token_identifier);
                payments.push(payment);
            }
            self.send().direct_multi(&address, &payments);
            refund_index += 1;
            tx_index += 1;
        }
        self.refund_index().set(0);
        self.addresses().clear();
        OperationCompletionStatus::Completed
    }

    #[endpoint(release)]
    fn release(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
        overcommited: MultiValueEncoded<ManagedAddress>,
    ) -> OperationCompletionStatus {
        self.validate_owner_call(timestamp, signature);
        self.raise_pool_enabled().set(false);
        let overcommited_len = overcommited.len();
        loop {
            match self.release_state().get() {
                ReleaseState::None => {
                    if overcommited_len > 0 {
                        let status =
                            self.refund_overcommited(overcommited.clone(), overcommited_len);
                        if status == OperationCompletionStatus::InterruptedBeforeOutOfGas {
                            return status;
                        }
                        self.release_state()
                            .set(ReleaseState::OvercommitersReleased);
                    } else {
                        self.release_state()
                            .set(ReleaseState::OvercommitersReleased);
                    }
                }
                ReleaseState::OvercommitersReleased => {
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
                    self.release_state().set(ReleaseState::AllReleased);
                }
                ReleaseState::AllReleased => {
                    self.retrieve();
                    self.release_state().set(ReleaseState::Retrieved);
                }
                ReleaseState::Retrieved => return OperationCompletionStatus::Completed,
            }
        }
    }

    fn retrieve(&self) {
        let caller = self.blockchain().get_caller();
        let mut payments = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            let amount = self.total_amount_currency(&token).get();
            if amount > 0 {
                payments.push(EsdtTokenPayment::new(token.clone(), 0, amount));
            }
        }
        self.send().direct_multi(&caller, &payments);
        for payment in &payments {
            self.decrease_totals(&payment.token_identifier, &payment.amount);
        }
    }

    #[endpoint(userRefund)]
    fn user_refund(&self, timestamp: u64, signature: ManagedBuffer, token: TokenIdentifier) {
        require!(self.refund_enabled().get(), "Refund is not enabled");
        require!(
            self.refund_deadline().get() > self.blockchain().get_block_timestamp(),
            "Refund deadline has passed"
        );
        let caller = self.blockchain().get_caller();
        require!(self.is_registered(&caller), "Wallet not registered");
        self.validate_user_refund_call(
            timestamp,
            &self.pool_id().get(),
            &caller,
            &token,
            self.signer().get(),
            signature,
        );
        let amount = self.release_token_user(&caller, &token);
        self.send().direct_esdt(&caller, &token, 0, &amount);
    }

    #[endpoint(adminRefund)]
    fn admin_refund(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
        addresses: MultiValueEncoded<ManagedAddress>,
    ) {
        self.validate_owner_call(timestamp, signature);
        for address in addresses {
            let mut payments: ManagedVec<EsdtTokenPayment> = ManagedVec::new();
            for token in self.deposited_currencies(&address).iter() {
                let payment = self.release_token_admin(&address, &token);
                payments.push(payment);
            }
            self.addresses().swap_remove(&address);
            self.send().direct_multi(&address, &payments);
        }
    }

    #[endpoint(setPlatformFeeWallet)]
    fn set_platform_fee_wallet(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
        wallet: ManagedAddress,
    ) {
        self.validate_owner_call(timestamp, signature);
        self.platform_fee_wallet().set(wallet);
    }

    #[endpoint(enableRaisePool)]
    fn enable_raise_pool(&self, value: bool, timestamp: u64, signature: ManagedBuffer) {
        self.validate_owner_call(timestamp, signature);
        require!(
            self.release_state().get() == ReleaseState::None,
            "Release in progress or already completed, cannot enable pool"
        );
        self.raise_pool_enabled().set(value);
    }

    #[endpoint(setTimestamps)]
    fn set_timestamps(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
        new_start_date: u64,
        new_end_date: u64,
        new_refund_deadline: u64,
    ) {
        self.validate_owner_call_on_enabled_pool(timestamp, signature);
        require!(
            new_start_date < new_refund_deadline && new_refund_deadline < new_end_date,
            "Invalid timestamps"
        );
        self.start_date().set(new_start_date);
        self.refund_deadline().set(new_refund_deadline);
        self.end_date().set(new_end_date);
        self.changed_timestamp_event(
            self.pool_id().get(),
            new_start_date,
            new_end_date,
            new_refund_deadline,
        );
    }

    #[endpoint(setRefundEnabled)]
    fn set_refund_enabled(&self, timestamp: u64, signature: ManagedBuffer, value: bool) {
        self.validate_owner_call(timestamp, signature);
        self.refund_enabled().set(value);
    }

    fn release_plaform(&self) {
        let mut payments: ManagedVec<EsdtTokenPayment> = ManagedVec::new();
        for token in self.payment_currencies().iter() {
            let fee = self.platform_fee(&token).get();
            if fee > 0 {
                payments.push(EsdtTokenPayment::new(token, 0, fee));
            }
        }
        self.send_multi_if_not_empty(&self.platform_fee_wallet().get(), &payments);
        for payment in &payments {
            self.decrease_totals(&payment.token_identifier, &payment.amount);
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
        self.send_multi_if_not_empty(&self.group_fee_wallet().get(), &payments);
        for payment in &payments {
            self.decrease_totals(&payment.token_identifier, &payment.amount);
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
                if amount > 0 {
                    payments.push(EsdtTokenPayment::new(
                        token_identifier.clone(),
                        0,
                        amount.clone(),
                    ));
                }
            }
            self.send_multi_if_not_empty(&ambassador, &payments);
            for payment in &payments {
                self.decrease_totals(&payment.token_identifier, &payment.amount);
            }
            release_ambassador_index += 1;
            tx_index += 1;
        }

        self.release_ambassador_index().set(ambassadors_len);
        OperationCompletionStatus::Completed
    }

    fn refund_overcommited(
        &self,
        overcommited: MultiValueEncoded<ManagedAddress>,
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
            let mut payments: ManagedVec<EsdtTokenPayment> = ManagedVec::new();
            let address = overcommited_iter.next().unwrap();
            for token in self.deposited_currencies(&address).iter() {
                let payment = self.release_token_admin(&address, &token);
                if payment.amount > 0 {
                    payments.push(payment);
                }
            }
            self.addresses().swap_remove(&address);
            self.send_multi_if_not_empty(&address, &payments);
            overcommited_index += 1;
            tx_index += 1;
        }
        self.overcommited_index().set(overcommited_len);
        OperationCompletionStatus::Completed
    }
}
