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
const PUBLISH_VERSION_DISCRIMINATOR: [u8; 8] = [191, 46, 141, 231, 171, 173, 99, 160];
const REVOKE_VERSION_DISCRIMINATOR: [u8; 8] = [235, 156, 77, 69, 162, 17, 93, 18];
const VERSION_ACCOUNT_DISCRIMINATOR: [u8; 8] = [97, 166, 101, 168, 173, 67, 190, 183];

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

fn create_resume_instruction(owner: &Address, resume_id: u64) -> Instruction {
    let mut data = CREATE_RESUME_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&resume_id.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(profile_address(owner), false),
            AccountMeta::new(resume_address(owner, resume_id), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn publish_version_instruction(
    owner: &Address,
    resume: &Address,
    version: u64,
    content_hash: [u8; 32],
    metadata_hash: [u8; 32],
    uri: &str,
) -> Instruction {
    let mut data = PUBLISH_VERSION_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&content_hash);
    data.extend_from_slice(&metadata_hash);
    data.extend_from_slice(&(uri.len() as u32).to_le_bytes());
    data.extend_from_slice(uri.as_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(*resume, false),
            AccountMeta::new(resume_version_address(resume, version), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn revoke_version_instruction(owner: &Address, resume: &Address, version: &Address) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*owner, true),
            AccountMeta::new_readonly(*resume, false),
            AccountMeta::new(*version, false),
        ],
        data: REVOKE_VERSION_DISCRIMINATOR.to_vec(),
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

fn create_resume(svm: &mut LiteSVM, owner: &Keypair, resume_id: u64) {
    send_instruction(
        svm,
        owner,
        create_resume_instruction(&owner.pubkey(), resume_id),
    )
    .expect("resume creation should succeed");
}

fn publish_version(
    svm: &mut LiteSVM,
    owner: &Keypair,
    resume: &Address,
    version: u64,
    content_hash: [u8; 32],
    metadata_hash: [u8; 32],
    uri: &str,
) {
    send_instruction(
        svm,
        owner,
        publish_version_instruction(
            &owner.pubkey(),
            resume,
            version,
            content_hash,
            metadata_hash,
            uri,
        ),
    )
    .expect("publish should succeed");
}

fn revoke_version(
    svm: &mut LiteSVM,
    owner: &Keypair,
    resume: &Address,
    version: &Address,
) -> Result<(), String> {
    send_instruction(
        svm,
        owner,
        revoke_version_instruction(&owner.pubkey(), resume, version),
    )
}

fn version_is_revoked_offset(data: &[u8]) -> usize {
    let uri_len = u32::from_le_bytes(data[144..148].try_into().unwrap()) as usize;
    // discriminator(8) + owner(32) + resume(32) + version(8) + hashes(64) + uri_len(4) + uri + created_at(8)
    148 + uri_len + 8
}

fn version_is_revoked(svm: &LiteSVM, version: &Address) -> bool {
    let account = svm.get_account(version).expect("version should exist");
    assert_eq!(&account.data[..8], &VERSION_ACCOUNT_DISCRIMINATOR);
    let offset = version_is_revoked_offset(&account.data);
    account.data[offset] == 1
}

/// Snapshot of every ResumeVersion field except `is_revoked`.
fn version_immutable_snapshot(svm: &LiteSVM, version: &Address) -> Vec<u8> {
    let account = svm.get_account(version).expect("version should exist");
    let mut data = account.data.clone();
    let offset = version_is_revoked_offset(&data);
    data[offset] = 0;
    data
}

fn resume_counters(svm: &LiteSVM, resume: &Address) -> (u64, u64) {
    let account = svm.get_account(resume).expect("resume should exist");
    (
        u64::from_le_bytes(account.data[48..56].try_into().unwrap()),
        u64::from_le_bytes(account.data[56..64].try_into().unwrap()),
    )
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

fn setup_with_published_version() -> (LiteSVM, Keypair, Address, Address) {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    let resume = resume_address(&owner.pubkey(), 0);
    publish_version(
        &mut svm,
        &owner,
        &resume,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/cv-v0.pdf",
    );
    let version = resume_version_address(&resume, 0);
    (svm, owner, resume, version)
}

#[test]
fn newly_published_version_is_not_revoked() {
    let (svm, _owner, _resume, version) = setup_with_published_version();
    assert!(!version_is_revoked(&svm, &version));
}

#[test]
fn owner_can_revoke_version_and_account_remains() {
    let (mut svm, owner, resume, version) = setup_with_published_version();

    revoke_version(&mut svm, &owner, &resume, &version).expect("revoke should succeed");

    assert!(version_is_revoked(&svm, &version));
    let account = svm.get_account(&version).expect("account must remain for audit");
    assert_eq!(account.owner, PROGRAM_ID);
    assert_eq!(account.data.len(), 358);
}

#[test]
fn revoke_is_idempotent_and_keeps_flag_true() {
    let (mut svm, owner, resume, version) = setup_with_published_version();

    revoke_version(&mut svm, &owner, &resume, &version).unwrap();
    svm.expire_blockhash();
    revoke_version(&mut svm, &owner, &resume, &version).expect("second revoke should succeed");
    assert!(version_is_revoked(&svm, &version));
}

#[test]
fn revoke_only_mutates_is_revoked_flag() {
    let (mut svm, owner, resume, version) = setup_with_published_version();
    let before_version = version_immutable_snapshot(&svm, &version);
    let before_resume = resume_counters(&svm, &resume);

    revoke_version(&mut svm, &owner, &resume, &version).unwrap();

    assert!(version_is_revoked(&svm, &version));
    assert_eq!(version_immutable_snapshot(&svm, &version), before_version);
    assert_eq!(resume_counters(&svm, &resume), before_resume);
}

#[test]
fn owner_can_revoke_older_version_without_affecting_newer() {
    let (mut svm, owner, resume, first_version) = setup_with_published_version();
    publish_version(
        &mut svm,
        &owner,
        &resume,
        1,
        [3; 32],
        [4; 32],
        "https://example.com/cv-v1.pdf",
    );
    let second_version = resume_version_address(&resume, 1);

    revoke_version(&mut svm, &owner, &resume, &first_version).unwrap();

    assert!(version_is_revoked(&svm, &first_version));
    assert!(!version_is_revoked(&svm, &second_version));
    assert_eq!(resume_counters(&svm, &resume), (1, 2));
}

#[test]
fn rejects_revoke_by_non_owner() {
    let (mut svm, _owner, resume, version) = setup_with_published_version();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 2_000_000_000).unwrap();

    let instruction = revoke_version_instruction(&attacker.pubkey(), &resume, &version);
    assert!(send_instruction(&mut svm, &attacker, instruction).is_err());
    assert!(!version_is_revoked(&svm, &version));
}

#[test]
fn rejects_transaction_that_omits_required_owner_signature() {
    let (mut svm, owner, resume, version) = setup_with_published_version();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 2_000_000_000).unwrap();

    let instruction = revoke_version_instruction(&owner.pubkey(), &resume, &version);
    let mut transaction =
        Transaction::new_unsigned(Message::new(&[instruction], Some(&attacker.pubkey())));
    assert!(transaction
        .try_sign(&[&attacker], svm.latest_blockhash())
        .is_err());
    assert!(!version_is_revoked(&svm, &version));
}

#[test]
fn rejects_revoke_of_another_wallets_version() {
    let (mut svm, owner) = setup();
    let victim = Keypair::new();
    svm.airdrop(&victim.pubkey(), 2_000_000_000).unwrap();

    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    let owner_resume = resume_address(&owner.pubkey(), 0);
    publish_version(
        &mut svm,
        &owner,
        &owner_resume,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/owner.pdf",
    );

    create_profile(&mut svm, &victim);
    create_resume(&mut svm, &victim, 0);
    let victim_resume = resume_address(&victim.pubkey(), 0);
    publish_version(
        &mut svm,
        &victim,
        &victim_resume,
        0,
        [5; 32],
        [6; 32],
        "https://example.com/victim.pdf",
    );
    let victim_version = resume_version_address(&victim_resume, 0);

    assert!(revoke_version(&mut svm, &owner, &victim_resume, &victim_version).is_err());
    assert!(!version_is_revoked(&svm, &victim_version));
}

#[test]
fn rejects_cross_wired_resume_and_version_accounts() {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    create_resume(&mut svm, &owner, 1);

    let first_resume = resume_address(&owner.pubkey(), 0);
    let second_resume = resume_address(&owner.pubkey(), 1);
    publish_version(
        &mut svm,
        &owner,
        &first_resume,
        0,
        [1; 32],
        [2; 32],
        "https://example.com/first.pdf",
    );
    publish_version(
        &mut svm,
        &owner,
        &second_resume,
        0,
        [3; 32],
        [4; 32],
        "https://example.com/second.pdf",
    );

    let first_version = resume_version_address(&first_resume, 0);
    // Same owner, but resume PDA does not own this version account.
    assert!(revoke_version(&mut svm, &owner, &second_resume, &first_version).is_err());
    assert!(!version_is_revoked(&svm, &first_version));
}

#[test]
fn rejects_unrelated_account_substituted_as_version() {
    let (mut svm, owner, resume, version) = setup_with_published_version();
    let decoy = Keypair::new();

    assert!(revoke_version(&mut svm, &owner, &resume, &decoy.pubkey()).is_err());
    assert!(!version_is_revoked(&svm, &version));
}

#[test]
fn rejects_profile_account_substituted_as_version() {
    let (mut svm, owner, resume, version) = setup_with_published_version();
    let profile = profile_address(&owner.pubkey());

    assert!(revoke_version(&mut svm, &owner, &resume, &profile).is_err());
    assert!(!version_is_revoked(&svm, &version));
}

#[test]
fn rejects_revoke_for_nonexistent_version() {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    let resume = resume_address(&owner.pubkey(), 0);
    let missing = resume_version_address(&resume, 0);

    assert!(revoke_version(&mut svm, &owner, &resume, &missing).is_err());
    assert!(svm.get_account(&missing).is_none());
}

#[test]
fn rejects_fake_version_pda_for_wrong_version_number() {
    let (mut svm, owner, resume, version_zero) = setup_with_published_version();
    // PDA for version 1 does not exist / is not the published account.
    let fake = resume_version_address(&resume, 1);

    assert!(revoke_version(&mut svm, &owner, &resume, &fake).is_err());
    assert!(!version_is_revoked(&svm, &version_zero));
    assert!(svm.get_account(&fake).is_none());
}
