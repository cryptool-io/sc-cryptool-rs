multiversx_sc::imports!();
multiversx_sc::derive_imports!();

use wallet_database::ProxyTrait as _;

pub const ALLOWED_TIMESTAMP_DELAY: u64 = 90;
pub const DEFAULT_DECIMALS: u32 = 18;

#[multiversx_sc::module]
pub trait HelperModule: crate::storage::StorageModule {
    fn validate_init(
        &self,
        soft_cap: &BigUint,
        hard_cap: &BigUint,
        min_deposit: &BigUint,
        max_deposit: &BigUint,
        start_date: u64,
        end_date: u64,
        _deposit_increments: &BigUint,
    ) {
        // require!(                                                                     // DISABLED
        //     min_deposit % deposit_increments == 0 && max_deposit % deposit_increments == 0,
        //     "Min and max deposit amounts must be a multiple of deposit increments"
        // );
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
    }

    fn validate_deposit(&self, payment: &EsdtTokenPayment, backend_timestamp: &u64) {
        let timestamp = self.blockchain().get_block_timestamp();
        require!(
            self.payment_currencies()
                .contains(&payment.token_identifier),
            "Invalid token payment"
        );
        require!(timestamp > self.start_date().get(), "Deposits not open yet");
        require!(timestamp < self.end_date().get(), "Deposits closed");
        require!(
            timestamp >= *backend_timestamp,
            "Backend timestamp higher than current timestamp"
        );
        require!(
            timestamp - backend_timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Deposit took too long"
        );
        require!(self.raise_pool_enabled().get(), "Pool is not enabled");
        // let min_deposit_denominated = self.match_denomination(self.min_deposit().get(), payment);  // DISABLED
        // require!(
        //     min_deposit_denominated <= payment.amount,
        //     "Payment amount too low"
        // );

        let caller = self.blockchain().get_caller();
        let mut total_caller_amount = BigUint::zero();
        for currency in self.deposited_currencies(&caller).iter() {
            let deposited_amount = self.deposited_amount(&caller, &currency).get();
            let denominated_amount = self.denominate_payment(&currency, &deposited_amount);
            total_caller_amount += denominated_amount;
        }

        // let increment = self.deposit_increments().get();                                             // DISABLED
        // let increment_denominted = self.match_denomination(increment, payment);
        // require!(
        //     &payment.amount % &increment_denominted == 0,
        //     "Payment amount is not a multiple of the deposit increment"
        // );
    }

    fn validate_owner_call_on_enabled_pool(&self, timestamp: u64, signature: ManagedBuffer) {
        require!(self.raise_pool_enabled().get(), "Pool is not enabled");
        self.validate_owner_call(timestamp, signature);
    }

    fn validate_owner_call(&self, timestamp: u64, signature: ManagedBuffer) {
        self.validate_signature(
            timestamp,
            &self.pool_id().get(),
            &self.blockchain().get_caller(),
            self.signer().get(),
            signature,
        );
        let caller = self.blockchain().get_caller();
        require!(
            caller == self.owner().get(),
            "Only owner can call this function"
        );
        require!(
            timestamp <= self.blockchain().get_block_timestamp(),
            "Timestamp provided by backend set in the future"
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Function call took too long"
        );
    }

    fn validate_signature(
        &self,
        timestamp: u64,
        pool_id: &ManagedBuffer,
        caller: &ManagedAddress,
        signer: ManagedAddress,
        signature: ManagedBuffer,
    ) {
        let mut buffer = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    fn validate_deposit_signature(
        &self,
        timestamp: u64,
        pool_id: &ManagedBuffer,
        caller: &ManagedAddress,
        platform_fee: &BigUint,
        group_fee: &BigUint,
        signer: ManagedAddress,
        signature: ManagedBuffer,
        ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>,
    ) {
        let mut buffer = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(caller.as_managed_buffer());
        let result = platform_fee.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = group_fee.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        if let Some(ambassador) = ambassador.into_option() {
            let (ambassador_percentage, ambassador_wallet) = ambassador.into_tuple();
            let result = ambassador_percentage.dep_encode(&mut buffer);
            require!(result.is_ok(), "Could not encode");
            buffer.append(ambassador_wallet.as_managed_buffer());
        }
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    fn validate_user_refund_call(
        &self,
        timestamp: u64,
        pool_id: &ManagedBuffer,
        caller: &ManagedAddress,
        token: &TokenIdentifier,
        signer: ManagedAddress,
        signature: ManagedBuffer,
    ) {
        let mut buffer = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(caller.as_managed_buffer());
        require!(result.is_ok(), "Could not encode");
        let result = token.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    fn denominate_payment(&self, token: &TokenIdentifier, amount: &BigUint) -> BigUint {
        match self.currency_decimals(token).get() {
            decimals if decimals != DEFAULT_DECIMALS => {
                amount * 10_u64.pow(DEFAULT_DECIMALS - decimals)
            }
            _ => amount.clone(),
        }
    }

    fn match_denomination(&self, amount: BigUint, payment: &EsdtTokenPayment) -> BigUint {
        let decimals = self.currency_decimals(&payment.token_identifier).get();
        amount * 10_u64.pow(decimals)
    }

    fn increase_totals(&self, token_identifier: &TokenIdentifier, amount: &BigUint) {
        let payment_denomination = self.denominate_payment(token_identifier, amount);
        self.total_amount()
            .update(|current| *current += payment_denomination);
        self.total_amount_currency(token_identifier)
            .update(|current| *current += amount);
    }

    fn decrease_totals(&self, token_identifier: &TokenIdentifier, amount: &BigUint) {
        let payment_denomination = self.denominate_payment(token_identifier, amount);
        self.total_amount()
            .update(|current| *current -= payment_denomination);
        self.total_amount_currency(token_identifier)
            .update(|current| *current -= amount);
    }

    fn increase_general(&self, address: &ManagedAddress, payment: &EsdtTokenPayment) {
        self.addresses().insert(address.clone());
        self.deposited_currencies(address)
            .insert(payment.token_identifier.clone());
        self.deposited_amount(address, &payment.token_identifier)
            .update(|current| *current += &payment.amount);
    }

    fn remove_general(&self, address: &ManagedAddress, token: &TokenIdentifier) {
        self.deposited_currencies(address).swap_remove(token);
        self.deposited_amount(address, token).clear();
    }

    fn increase_platform_fee(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
        platform_fee: &BigUint,
    ) {
        let denominated_platform_fee = self.denominate_payment(token, platform_fee);
        self.address_platform_fee(address, token)
            .update(|current| *current += platform_fee);
        self.platform_fee(token)
            .update(|current| *current += platform_fee);
        self.total_platform_fee()
            .update(|current| *current += &denominated_platform_fee);
    }

    fn remove_platform_fee(&self, address: &ManagedAddress, token: &TokenIdentifier) {
        let fee_amount = self.address_platform_fee(address, token).take();
        let fee_amount_denominated = self.denominate_payment(token, &fee_amount);
        self.platform_fee(token)
            .update(|current| *current -= fee_amount);
        self.total_platform_fee()
            .update(|current| *current -= fee_amount_denominated);
    }

    fn increase_group_fee(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
        group_fee: &BigUint,
    ) {
        let denominated_group_fee = self.denominate_payment(token, group_fee);
        self.address_group_fee(address, token)
            .update(|current| *current += group_fee);
        self.group_fee(token)
            .update(|current| *current += group_fee);
        self.total_group_fee()
            .update(|current| *current += &denominated_group_fee);
    }

    fn remove_group_fee(&self, address: &ManagedAddress, token: &TokenIdentifier) {
        let fee_amount = self.address_group_fee(address, token).take();
        let fee_amount_denominated = self.denominate_payment(token, &fee_amount);
        self.group_fee(token)
            .update(|current| *current -= fee_amount);
        self.total_group_fee()
            .update(|current| *current -= fee_amount_denominated);
    }

    fn increase_ambassador_fee(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
        ambassador_amount: &BigUint,
        ambassador_wallet: ManagedAddress,
    ) {
        self.ambassadors().insert(ambassador_wallet.clone());
        let denominated_ambassador_fee = self.denominate_payment(token, ambassador_amount);
        self.total_ambassador_fee()
            .update(|current| *current += &denominated_ambassador_fee);
        self.address_ambassador_fee(address, token)
            .update(|current| *current += ambassador_amount);
        self.ambassador_fee(token)
            .update(|current| *current += ambassador_amount);
        self.referral_ambassador_fee(&ambassador_wallet, token)
            .update(|current| *current += ambassador_amount);
        self.ambassador_currencies(&ambassador_wallet)
            .insert(token.clone());
        if self.address_to_ambassador(address).is_empty() {
            self.address_to_ambassador(address)
                .set(ambassador_wallet.clone());
        }
    }

    fn decrease_ambassador_fee(&self, address: &ManagedAddress, token: &TokenIdentifier) {
        let ambassador_amount = self.address_ambassador_fee(address, token).take();
        let ambassador_amount_denomination = self.denominate_payment(token, &ambassador_amount);
        let ambassador_wallet = self.address_to_ambassador(address).get();
        self.total_ambassador_fee()
            .update(|current| *current -= &ambassador_amount_denomination);
        self.ambassador_fee(token)
            .update(|current| *current -= &ambassador_amount);
        self.referral_ambassador_fee(&ambassador_wallet, token)
            .update(|current| *current -= &ambassador_amount);
        if self
            .referral_ambassador_fee(&ambassador_wallet, token)
            .get()
            == 0
        {
            self.ambassador_currencies(&ambassador_wallet)
                .swap_remove(token);
            self.address_to_ambassador(address).clear();
            self.referral_ambassador_fee(&ambassador_wallet, token)
                .clear();
        }
        if self.ambassador_currencies(&ambassador_wallet).is_empty() {
            self.ambassadors().swap_remove(&ambassador_wallet);
        }
    }

    fn release_token_user(&self, address: &ManagedAddress, token: &TokenIdentifier) -> BigUint {
        let mut amount = self.deposited_amount(address, token).get();
        let platform_fee = self.address_platform_fee(address, token).get();
        let ambassador_fee = self.address_ambassador_fee(address, token).get();
        amount = amount - platform_fee - ambassador_fee;
        self.deposited_currencies(address).swap_remove(token);
        self.decrease_totals(token, &amount);
        self.remove_general(address, token);
        self.remove_group_fee(address, token);
        amount
    }

    fn release_token_admin(
        &self,
        address: &ManagedAddress,
        token: &TokenIdentifier,
    ) -> EsdtTokenPayment {
        let amount = self.deposited_amount(address, token).get();
        self.deposited_currencies(address).swap_remove(token);
        self.decrease_totals(token, &amount);
        self.remove_general(address, token);
        self.remove_platform_fee(address, token);
        self.remove_group_fee(address, token);
        if !self.address_to_ambassador(address).is_empty() {
            self.decrease_ambassador_fee(address, token);
        }
        EsdtTokenPayment::new(token.clone(), 0, amount)
    }

    fn is_registered(&self, address: &ManagedAddress) -> bool {
        self.wallet_database_proxy(self.wallet_database_address().get())
            .is_registered(address)
            .execute_on_dest_context::<bool>()
    }

    #[proxy]
    fn wallet_database_proxy(
        &self,
        callee_sc_address: ManagedAddress,
    ) -> wallet_database::Proxy<Self::Api>;
}
