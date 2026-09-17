use litesvm::LiteSVM;
use solana_address::{address, Address};
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_system_interface::program::ID as SYSTEM_PROGRAM_ID;
use solana_transaction::Transaction;
use std::path::PathBuf;

const PROGRAM_ID: Address = address!("8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63");
const PROFILE_SEED: &[u8] = b"profile";
const CREATE_PROFILE_DISCRIMINATOR: [u8; 8] = [225, 205, 234, 143, 17, 186, 50, 220];
const ANCHOR_ACCOUNT_DISCRIMINATOR: [u8; 8] = [32, 37, 119, 205, 179, 180, 13, 194];

fn profile_address(owner: &Address) -> Address {
    Address::find_program_address(&[PROFILE_SEED, owner.as_ref()], &PROGRAM_ID).0
}

fn create_profile_instruction(owner: &Address, profile: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            solana_instruction::AccountMeta::new(*owner, true),
            solana_instruction::AccountMeta::new(*profile, false),
            solana_instruction::AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: CREATE_PROFILE_DISCRIMINATOR.to_vec(),
    }
}

fn send_create_profile(svm: &mut LiteSVM, owner: &Keypair) -> Result<(), String> {
    let owner_address = owner.pubkey();
    let profile = profile_address(&owner_address);
    let transaction = Transaction::new(
        &[owner],
        Message::new(
            &[create_profile_instruction(&owner_address, &profile)],
            Some(&owner_address),
        ),
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction)
        .map(|_| ())
        .map_err(|error| format!("transaction failed: {error:?}"))
}

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let program_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("target/deploy/resume.so");
    svm.add_program_from_file(PROGRAM_ID, program_path)
        .expect("compiled resume program is required");
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 2_000_000_000)
        .expect("airdrop should succeed");
    (svm, owner)
}

#[test]
fn create_profile_initializes_owner_and_zero_counters() {
    let (mut svm, owner) = setup();
    let owner_address = owner.pubkey();
    let profile_address = profile_address(&owner_address);

    send_create_profile(&mut svm, &owner).expect("profile creation should succeed");

    let account = svm.get_account(&profile_address).expect("profile exists");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), 89);
    assert_eq!(&account.data[..8], &ANCHOR_ACCOUNT_DISCRIMINATOR);
    assert_eq!(&account.data[8..40], owner_address.as_ref());
    assert_eq!(&account.data[40..48], &[0; 8]);
    assert_eq!(&account.data[48..56], &[0; 8]);
}

#[test]
fn duplicate_profile_creation_is_rejected() {
    let (mut svm, owner) = setup();
    send_create_profile(&mut svm, &owner).expect("first creation should succeed");
    assert!(send_create_profile(&mut svm, &owner).is_err());
}

#[test]
fn different_wallets_get_independent_profiles() {
    let (mut svm, first_owner) = setup();
    let second_owner = Keypair::new();
    svm.airdrop(&second_owner.pubkey(), 2_000_000_000)
        .expect("airdrop should succeed");

    send_create_profile(&mut svm, &first_owner).expect("first profile should succeed");
    send_create_profile(&mut svm, &second_owner).expect("second profile should succeed");

    let first_profile = profile_address(&first_owner.pubkey());
    let second_profile = profile_address(&second_owner.pubkey());
    assert_ne!(first_profile, second_profile);
    assert_eq!(
        svm.get_account(&first_profile).unwrap().data[8..40],
        first_owner.pubkey().to_bytes()
    );
    assert_eq!(
        svm.get_account(&second_profile).unwrap().data[8..40],
        second_owner.pubkey().to_bytes()
    );
}
