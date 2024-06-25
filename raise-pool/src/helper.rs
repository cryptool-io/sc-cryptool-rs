multiversx_sc::imports!();
multiversx_sc::derive_imports!();

pub const ALLOWED_TIMESTAMP_DELAY: u64 = 90;

#[multiversx_sc::module]
pub trait HelperModule: crate::storage::StorageModule  {
    fn validate_init(
        &self,
        soft_cap: &BigUint,
        hard_cap: &BigUint,
        min_deposit: &BigUint,
        max_deposit: &BigUint,
        start_date: u64,
        end_date: u64,
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
    }

    fn validate_deposit(&self, payment: &EsdtTokenPayment) {
        let timestamp = self.blockchain().get_block_timestamp();
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Deposit took too long"
        );
        require!(
            self.raise_pool_enabled().get() == true,
            "Pool is not enabled"
        );
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
        require!(
            self.payment_currencies()
                .contains(&payment.token_identifier),
            "Invalid token payment"
        );
    }

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

}
