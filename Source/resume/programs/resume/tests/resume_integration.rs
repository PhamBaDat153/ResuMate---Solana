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
const RESUME_SEED: &[u8] = b"resume";
const RESUME_VERSION_SEED: &[u8] = b"resume-version";
const CREATE_PROFILE_DISCRIMINATOR: [u8; 8] = [225, 205, 234, 143, 17, 186, 50, 220];
const CREATE_RESUME_DISCRIMINATOR: [u8; 8] = [197, 76, 123, 247, 186, 23, 70, 255];
const RESUME_ACCOUNT_DISCRIMINATOR: [u8; 8] = [185, 23, 118, 57, 225, 253, 34, 230];

fn profile_address(owner: &Address) -> Address {
    Address::find_program_address(&[PROFILE_SEED, owner.as_ref()], &PROGRAM_ID).0
}

fn resume_address(owner: &Address, resume_id: u64) -> Address {
    Address::find_program_address(
        &[RESUME_SEED, owner.as_ref(), &resume_id.to_le_bytes()],
        &PROGRAM_ID,
    )
    .0
}

fn resume_version_address(resume: &Address, version: u64) -> Address {
    Address::find_program_address(
        &[RESUME_VERSION_SEED, resume.as_ref(), &version.to_le_bytes()],
        &PROGRAM_ID,
    )
    .0
}

fn create_profile_instruction(owner: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(profile_address(owner), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data: CREATE_PROFILE_DISCRIMINATOR.to_vec(),
    }
}

fn create_resume_instruction(owner: &Address, profile: &Address, resume_id: u64) -> Instruction {
    let mut data = CREATE_RESUME_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&resume_id.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(*profile, false),
            AccountMeta::new(resume_address(owner, resume_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
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

fn create_profile(svm: &mut LiteSVM, owner: &Keypair) {
    send_instruction(svm, owner, create_profile_instruction(&owner.pubkey()))
        .expect("profile creation should succeed");
}

fn create_resume(svm: &mut LiteSVM, owner: &Keypair, resume_id: u64) -> Result<(), String> {
    send_instruction(
        svm,
        owner,
        create_resume_instruction(
            &owner.pubkey(),
            &profile_address(&owner.pubkey()),
            resume_id,
        ),
    )
}

fn profile_resume_count(svm: &LiteSVM, owner: &Address) -> u64 {
    let account = svm
        .get_account(&profile_address(owner))
        .expect("profile should exist");
    u64::from_le_bytes(account.data[40..48].try_into().unwrap())
}

fn assert_resume_state(svm: &LiteSVM, owner: &Address, resume_id: u64) {
    let resume = resume_address(owner, resume_id);
    let account = svm.get_account(&resume).expect("resume should exist");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), 98);
    assert_eq!(&account.data[..8], &RESUME_ACCOUNT_DISCRIMINATOR);
    assert_eq!(&account.data[8..40], owner.as_ref());
    assert_eq!(
        u64::from_le_bytes(account.data[40..48].try_into().unwrap()),
        resume_id
    );
    assert_eq!(&account.data[48..56], &[0; 8]);
    assert_eq!(&account.data[56..64], &[0; 8]);
    assert_eq!(account.data[64], 0);
    assert!(svm
        .get_account(&resume_version_address(&resume, 0))
        .is_none());
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
fn creates_sequential_resumes_with_empty_private_state() {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);

    create_resume(&mut svm, &owner, 0).expect("resume zero should succeed");
    assert_resume_state(&svm, &owner.pubkey(), 0);
    assert_eq!(profile_resume_count(&svm, &owner.pubkey()), 1);

    create_resume(&mut svm, &owner, 1).expect("resume one should succeed");
    assert_resume_state(&svm, &owner.pubkey(), 1);
    assert_eq!(profile_resume_count(&svm, &owner.pubkey()), 2);
}

#[test]
fn different_wallets_create_independent_resume_zero_accounts() {
    let (mut svm, first_owner) = setup();
    let second_owner = Keypair::new();
    svm.airdrop(&second_owner.pubkey(), 2_000_000_000)
        .expect("airdrop should succeed");
    create_profile(&mut svm, &first_owner);
    create_profile(&mut svm, &second_owner);

    create_resume(&mut svm, &first_owner, 0).expect("first resume should succeed");
    create_resume(&mut svm, &second_owner, 0).expect("second resume should succeed");

    let first_resume = resume_address(&first_owner.pubkey(), 0);
    let second_resume = resume_address(&second_owner.pubkey(), 0);
    assert_ne!(first_resume, second_resume);
    assert_resume_state(&svm, &first_owner.pubkey(), 0);
    assert_resume_state(&svm, &second_owner.pubkey(), 0);
}

#[test]
fn rejects_non_sequential_and_duplicate_ids_without_state_changes() {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);

    assert!(create_resume(&mut svm, &owner, 1).is_err());
    assert_eq!(profile_resume_count(&svm, &owner.pubkey()), 0);
    assert!(svm
        .get_account(&resume_address(&owner.pubkey(), 1))
        .is_none());

    create_resume(&mut svm, &owner, 0).expect("resume zero should succeed");
    assert_eq!(profile_resume_count(&svm, &owner.pubkey()), 1);
    assert!(create_resume(&mut svm, &owner, 0).is_err());
    assert_eq!(profile_resume_count(&svm, &owner.pubkey()), 1);
    assert_resume_state(&svm, &owner.pubkey(), 0);
}

#[test]
fn rejects_a_profile_owned_by_another_wallet() {
    let (mut svm, profile_owner) = setup();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 2_000_000_000)
        .expect("airdrop should succeed");
    create_profile(&mut svm, &profile_owner);

    let instruction = create_resume_instruction(
        &attacker.pubkey(),
        &profile_address(&profile_owner.pubkey()),
        0,
    );
    assert!(send_instruction(&mut svm, &attacker, instruction).is_err());
    assert_eq!(profile_resume_count(&svm, &profile_owner.pubkey()), 0);
    assert!(svm
        .get_account(&resume_address(&attacker.pubkey(), 0))
        .is_none());
}
