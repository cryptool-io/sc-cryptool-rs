#![no_std]

use multiversx_sc::imports::*;
mod storage;
use storage::ReleaseState;

pub const MAX_PERCENTAGE: u64 = 10_000;
pub const DEFAULT_DECIMALS: u32 = 18;
pub const BULK_BATCH: usize = 100;
pub const MIN_GAS_FOR_OPERATION: u64 = 2_000_000;

#[multiversx_sc::contract]
pub trait RaisePool: crate::storage::StorageModule {
    #[init]
    fn init(
        &self,
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
        self.raise_pool_enabled().set(false);
        self.signer().set(&signer);
        self.pool_id().set(pool_id);
        self.release_state().set(ReleaseState::None);
    }

    #[upgrade]
    fn upgrade(&self) {}

    fn validate_signature(
        &self,
        timestamp: u64,
        pool_id: &u32,
        caller: &ManagedAddress,
        signer: ManagedAddress,
        signature: ManagedBuffer,
    ) {
        let mut buffer = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(&caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    fn validate_deploy_signature(
        &self,
        timestamp: u64,
        pool_id: &u32,
        caller: &ManagedAddress,
        platform_fee_percentage: &BigUint,
        group_fee_percentage: &BigUint,
        signer: ManagedAddress,
        signature: ManagedBuffer,
        ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>,
    ) {
        let mut buffer = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(&caller.as_managed_buffer());
        let result = platform_fee_percentage.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = group_fee_percentage.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        match ambassador.into_option() {
            Some(ambassador) => {
                let (ambassador_percentage, ambassador_wallet) = ambassador.into_tuple();
                let result = ambassador_percentage.dep_encode(&mut buffer);
                require!(result.is_ok(), "Could not encode");
                buffer.append(&ambassador_wallet.as_managed_buffer());
            }
            None => {}
        }
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    #[only_owner]
    #[endpoint(enableRaisePool)]
    fn enable_raise_pool(&self) {
        self.raise_pool_enabled().set(true);
    }

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
            ambassador.clone() 
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < 60,
            "Deposit took too long"
        );

        require!(self.raise_pool_enabled().get() == true, "Pool is not enabled");

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

        require!(
            self.total_amount().get() + &payment_denomination <= self.hard_cap().get(),
            "Hard cap threshold would be exceeded"
        );

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
                self.ambassadors().insert(ambassador_wallet.clone());
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

    #[endpoint(refund)]
    fn refund(
        &self,
        timestamp: u64,
        signature: ManagedBuffer,
    ) -> OperationCompletionStatus {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();
        let pool_id = self.pool_id().get();
        self.validate_signature(timestamp, &pool_id, &caller, signer, signature);
        require!(
            self.blockchain().get_block_timestamp() - timestamp < 60,
            "Refund took too long"
        );
        require!(self.refund_enabled().get(), "Refunds are not enabled");
        require!(
            self.blockchain().get_block_timestamp() > self.end_date().get(),
            "Refunds are not open"
        );
        require!(
            self.total_amount().get() < self.hard_cap().get(),
            "Hard cap exceeded"
        );

        let addresses_len = self.addresses().len();
        let addresses = self.addresses();
        let mut addresses_iter = addresses.into_iter();
        let refund_index = self.refund_index().get();
        while refund_index < addresses_len {
            let start_index = refund_index;
            let end_index = (start_index + BULK_BATCH).min(addresses_len);
            for idx in start_index..end_index {
                if self.blockchain().get_gas_left() < MIN_GAS_FOR_OPERATION {
                    self.refund_index().set(idx);
                    return OperationCompletionStatus::InterruptedBeforeOutOfGas;
                }
                let address = addresses_iter.nth(idx).unwrap();
                let mut payments = ManagedVec::new();
                for token_identifier in self.deposited_currencies(&address).iter() {
                    let amount = self.deposited_amount(&address, &token_identifier).get();
                    payments.push(EsdtTokenPayment::new(token_identifier, 0, amount));
                }
                self.send().direct_multi(&address, &payments);
            }
            self.refund_index().set(end_index);
        }
        OperationCompletionStatus::Completed
    }

    #[endpoint(release_plaform)]
    fn release_plaform(&self) {
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
    }

    fn release_group(&self) {
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

    fn release_ambassadors(&self) -> OperationCompletionStatus {
        let ambassadors_len = self.ambassadors().len();
        let release_index = self.release_index().get();
        let ambassadors = self.ambassadors();
        let mut ambassadors_iter = ambassadors.into_iter();
        while release_index < ambassadors_len {
            let start_index = release_index;
            let end_index = (start_index + BULK_BATCH).min(ambassadors_len);
            for idx in start_index..end_index {
                if self.blockchain().get_gas_left() < MIN_GAS_FOR_OPERATION {
                    self.release_index().set(idx);
                    return OperationCompletionStatus::InterruptedBeforeOutOfGas;
                }
                let ambassador = ambassadors_iter.nth(idx).unwrap();
                let mut payments = ManagedVec::new();
                for token_identifier in self.ambassador_currencies(&ambassador).iter() {
                    let amount = self
                        .referral_ambassador_fee(&ambassador, &token_identifier)
                        .get();
                    payments.push(EsdtTokenPayment::new(token_identifier, 0, amount));
                }
                self.send().direct_multi(&ambassador, &payments);
            }
            self.release_index().set(end_index);
        }

        OperationCompletionStatus::Completed
    }

    fn refund_overcommited(
        &self,
        overcommited: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>,
    ) -> OperationCompletionStatus {
        let overcommited_len = overcommited.len();
        let overcommited_index = self.overcommited_index().get();
        let mut overcommited_iter = overcommited.into_iter();
        while overcommited_index < overcommited_len {
            let start_index = overcommited_index;
            let end_index = (start_index + BULK_BATCH).min(overcommited_len);
            for idx in start_index..end_index {
                if self.blockchain().get_gas_left() < MIN_GAS_FOR_OPERATION {
                    self.overcommited_index().set(idx);
                    return OperationCompletionStatus::InterruptedBeforeOutOfGas;
                }
                let overcommitment_data = overcommited_iter.nth(idx).unwrap();
                let (overcommiter, token_identifier, amount) = overcommitment_data.into_tuple();
                self.send()
                    .direct_esdt(&overcommiter, &token_identifier, 0, &amount);
            }
            self.overcommited_index().set(end_index);
        }
        OperationCompletionStatus::Completed
    }

    #[endpoint(release)]
    fn release(
        &self,
        pool_id: u32,
        timestamp: u64,
        signature: ManagedBuffer,
        overcommited: OptionalValue<
            MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>,
        >,
    ) -> OperationCompletionStatus {
        let caller = self.blockchain().get_caller();
        let signer = self.signer().get();
        self.validate_signature(timestamp, &pool_id, &caller, signer, signature);
        require!(
            self.blockchain().get_block_timestamp() - timestamp < 60,
            "Deposit took too long"
        );
        let overcommited_into_option = overcommited.into_option();

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
                ReleaseState::AmbassadorsReleased => match overcommited_into_option {
                    Some(ref overcommited) => {
                        let status = self.refund_overcommited(overcommited.clone());
                        if status == OperationCompletionStatus::InterruptedBeforeOutOfGas {
                            return status;
                        }
                        self.release_state().set(ReleaseState::AllReleased);
                    }
                    None => {
                        self.release_state().set(ReleaseState::AllReleased);
                    }
                },
                ReleaseState::AllReleased => return OperationCompletionStatus::Completed,
            }
        }
    }
}
