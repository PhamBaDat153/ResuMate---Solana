use litesvm::LiteSVM;
use solana_address::{address, Address};
use solana_instruction::{AccountMeta, Instruction};
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
const PROFILE_ACCOUNT_LEN: usize = 89;

fn profile_pda(owner: &Address) -> (Address, u8) {
    Address::find_program_address(&[PROFILE_SEED, owner.as_ref()], &PROGRAM_ID)
}

fn profile_address(owner: &Address) -> Address {
    profile_pda(owner).0
}

fn create_profile_instruction(owner: &Address, profile: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(*profile, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: CREATE_PROFILE_DISCRIMINATOR.to_vec(),
    }
}

fn send_instruction(
    svm: &mut LiteSVM,
    payer: &Keypair,
    instruction: Instruction,
) -> Result<(), String> {
    let transaction = Transaction::new(
        &[payer],
        Message::new(&[instruction], Some(&payer.pubkey())),
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction)
        .map(|_| ())
        .map_err(|error| format!("transaction failed: {error:?}"))
}

fn send_create_profile(svm: &mut LiteSVM, owner: &Keypair) -> Result<(), String> {
    let owner_address = owner.pubkey();
    let profile = profile_address(&owner_address);
    send_instruction(
        svm,
        owner,
        create_profile_instruction(&owner_address, &profile),
    )
}

fn assert_profile_state(svm: &LiteSVM, owner: &Address) {
    let (expected_address, expected_bump) = profile_pda(owner);
    let account = svm
        .get_account(&expected_address)
        .expect("profile should exist");

    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), PROFILE_ACCOUNT_LEN);
    assert_eq!(&account.data[..8], &ANCHOR_ACCOUNT_DISCRIMINATOR);
    assert_eq!(&account.data[8..40], owner.as_ref());
    assert_eq!(&account.data[40..48], &[0; 8], "resume_count must start at 0");
    assert_eq!(
        &account.data[48..56],
        &[0; 8],
        "credential_count must start at 0"
    );
    assert_eq!(account.data[56], expected_bump, "stored bump must match PDA");
    assert_eq!(&account.data[57..89], &[0; 32], "reserved must be zeroed");
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
fn create_profile_initializes_owner_zero_counters_bump_and_reserved() {
    let (mut svm, owner) = setup();
    send_create_profile(&mut svm, &owner).expect("profile creation should succeed");
    assert_profile_state(&svm, &owner.pubkey());
}

#[test]
fn duplicate_profile_creation_is_rejected() {
    let (mut svm, owner) = setup();
    send_create_profile(&mut svm, &owner).expect("first creation should succeed");
    assert!(send_create_profile(&mut svm, &owner).is_err());
    assert_profile_state(&svm, &owner.pubkey());
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
    assert_profile_state(&svm, &first_owner.pubkey());
    assert_profile_state(&svm, &second_owner.pubkey());
}

#[test]
fn rejects_profile_pda_derived_from_another_wallet() {
    let (mut svm, owner) = setup();
    let other = Keypair::new();
    let foreign_profile = profile_address(&other.pubkey());

    let result = send_instruction(
        &mut svm,
        &owner,
        create_profile_instruction(&owner.pubkey(), &foreign_profile),
    );
    assert!(result.is_err());
    assert!(svm.get_account(&foreign_profile).is_none());
    assert!(svm
        .get_account(&profile_address(&owner.pubkey()))
        .is_none());
}

#[test]
fn rejects_unrelated_account_as_profile_pda() {
    let (mut svm, owner) = setup();
    let decoy = Keypair::new();

    let result = send_instruction(
        &mut svm,
        &owner,
        create_profile_instruction(&owner.pubkey(), &decoy.pubkey()),
    );
    assert!(result.is_err());
    assert!(svm
        .get_account(&profile_address(&owner.pubkey()))
        .is_none());
}

#[test]
fn rejects_create_profile_when_payer_has_insufficient_lamports() {
    let mut svm = LiteSVM::new();
    let program_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("target/deploy/resume.so");
    svm.add_program_from_file(PROGRAM_ID, program_path)
        .expect("compiled resume program is required");

    let owner = Keypair::new();
    // Far below rent-exempt minimum for a UserProfile account.
    svm.airdrop(&owner.pubkey(), 5_000)
        .expect("tiny airdrop should succeed");

    assert!(send_create_profile(&mut svm, &owner).is_err());
    assert!(svm
        .get_account(&profile_address(&owner.pubkey()))
        .is_none());
}
