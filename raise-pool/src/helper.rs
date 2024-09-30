multiversx_sc::imports!();
multiversx_sc::derive_imports!();

use wallet_database::ProxyTrait as _;

pub const MAX_PERCENTAGE: u64 = 10_000;
pub const ALLOWED_TIMESTAMP_DELAY: u64 = 90;
pub const DEFAULT_DECIMALS: u32 = 18;

#[multiversx_sc::module]
pub trait HelperModule: crate::storage::StorageModule {
    #[only_owner]
    #[endpoint(enableRaisePool)]
    fn enable_raise_pool(&self, value: bool) {
        self.raise_pool_enabled().set(value);
    }

    fn validate_init(
        &self,
        soft_cap: &BigUint,
        hard_cap: &BigUint,
        min_deposit: &BigUint,
        max_deposit: &BigUint,
        start_date: u64,
        end_date: u64,
        deposit_increments: &BigUint,
    ) {
        require!(
            min_deposit % deposit_increments == 0 && max_deposit % deposit_increments == 0,
            "Min and max deposit amounts must be a multiple of deposit increments"
        );
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
        require!(timestamp > self.start_date().get(), "Deposits not open yet");
        require!(
            timestamp >= *backend_timestamp,
            "Backend timestamp higher than current timestamp"
        );
        require!(
            timestamp - backend_timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Deposit took too long"
        );
        require!(
            self.raise_pool_enabled().get() == true,
            "Pool is not enabled"
        );
        let min_deposit_denominated = self.match_denomination(self.min_deposit().get(), payment);
        require!(
            min_deposit_denominated <= payment.amount,
            "Payment amount too low"
        );
        let max_deposit_denominated = self.match_denomination(self.max_deposit().get(), payment);
        require!(
            payment.amount <= max_deposit_denominated,
            "Payment amount too high"
        );

        let caller = self.blockchain().get_caller();
        let mut total_caller_amount = BigUint::zero();
        for currency in self.deposited_currencies(&caller).iter() {
            let deposited_amount = self.deposited_amount(&caller, &currency).get();
            let payment = EsdtTokenPayment::new(currency, 0, deposited_amount);
            let denominated_amount = self.denominate_payment(&payment);
            total_caller_amount += denominated_amount;
        }
        let payment_denomination = self.denominate_payment(&payment);
        require!(
            total_caller_amount + &payment_denomination
                <= self.max_deposit().get() * 10_u64.pow(DEFAULT_DECIMALS),
            "Max_deposit threshold would be exceeded"
        );

        require!(
            self.total_amount().get() + &payment_denomination
                <= self.hard_cap().get() * 10_u64.pow(DEFAULT_DECIMALS),
            "Hard cap threshold would be exceeded"
        );

        let increment = self.deposit_increments().get();
        let increment_denominted = self.match_denomination(increment, &payment);
        require!(
            &payment.amount % &increment_denominted == 0,
            "Payment amount is not a multiple of the deposit increment"
        );
    }

    fn validate_owner_call(&self, timestamp: u64, signature: ManagedBuffer) {
        require!(
            self.raise_pool_enabled().get() == true,
            "Pool is not enabled"
        );
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
        buffer.append(&caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    fn validate_deploy_signature(
        &self,
        timestamp: u64,
        pool_id: &ManagedBuffer,
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

    fn denominate_payment(&self, payment: &EsdtTokenPayment) -> BigUint {
        match self.currency_decimals(&payment.token_identifier).get() {
            decimals if decimals != DEFAULT_DECIMALS => {
                &payment.amount * 10_u64.pow(DEFAULT_DECIMALS - decimals)
            }
            _ => payment.amount.clone(),
        }
    }

    fn match_denomination(&self, amount: BigUint, payment: &EsdtTokenPayment) -> BigUint {
        let decimals = self.currency_decimals(&payment.token_identifier).get();
        amount * 10_u64.pow(decimals)
    }

    fn decrease_totals(&self, token_identifier: TokenIdentifier, amount: BigUint) {
        let payment = EsdtTokenPayment::new(token_identifier.clone(), 0, amount.clone());
        let payment_denomination = self.denominate_payment(&payment);
        self.total_amount()
            .update(|current| *current -= &payment_denomination);
        self.total_amount_currency(&token_identifier)
            .update(|current| *current -= &amount);
    }

    fn update_general(&self, caller: &ManagedAddress, payment: &EsdtTokenPayment) {
        self.addresses().insert(caller.clone());
        self.deposited_currencies(&caller)
            .insert(payment.token_identifier.clone());
        self.deposited_amount(&caller, &payment.token_identifier)
            .update(|current| *current += &payment.amount);
    }

    fn update_platform_fee(
        &self,
        caller: &ManagedAddress,
        payment: &EsdtTokenPayment,
        payment_denomination: &BigUint,
        platform_fee_percentage: &BigUint,
    ) {
        let platform_fee_amount = (&payment.amount * platform_fee_percentage) / MAX_PERCENTAGE;
        let denominated_platform_fee_amount =
            (payment_denomination * platform_fee_percentage) / MAX_PERCENTAGE;
        self.address_platform_fee(&caller, &payment.token_identifier)
            .update(|current| *current += &platform_fee_amount);
        self.platform_fee(&payment.token_identifier)
            .update(|current| *current += &platform_fee_amount);
        self.total_platform_fee()
            .update(|current| *current += &denominated_platform_fee_amount);
    }

    fn update_group_fee(
        &self,
        caller: &ManagedAddress,
        payment: &EsdtTokenPayment,
        payment_denomination: &BigUint,
        group_fee_percentage: &BigUint,
    ) {
        let group_fee_amount = (&payment.amount * group_fee_percentage) / MAX_PERCENTAGE;
        let denominated_group_fee_amount =
            (payment_denomination * group_fee_percentage) / MAX_PERCENTAGE;
        self.address_group_fee(&caller, &payment.token_identifier)
            .update(|current| *current += &group_fee_amount);
        self.group_fee(&payment.token_identifier)
            .update(|current| *current += &group_fee_amount);
        self.total_group_fee()
            .update(|current| *current += &denominated_group_fee_amount);
    }

    fn update_ambassador_fee(
        &self,
        caller: &ManagedAddress,
        payment: &EsdtTokenPayment,
        ambassador: MultiValue2<BigUint, ManagedAddress>,
    ) {
        let (ambassador_percentage, ambassador_wallet) = ambassador.into_tuple();
        self.ambassadors().insert(ambassador_wallet.clone());
        let ambassador_amount = (&payment.amount * &ambassador_percentage) / MAX_PERCENTAGE;
        self.address_ambassador_fee(&caller, &payment.token_identifier)
            .update(|current| *current += &ambassador_amount);
        self.ambassador_fee(&payment.token_identifier)
            .update(|current| *current += &ambassador_amount);
        self.referral_ambassador_fee(&ambassador_wallet, &payment.token_identifier)
            .update(|current| *current += &ambassador_amount);
        self.ambassador_currencies(&ambassador_wallet)
            .insert(payment.token_identifier.clone());
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
