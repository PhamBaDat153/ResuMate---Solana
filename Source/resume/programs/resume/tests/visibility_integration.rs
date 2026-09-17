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
const CREATE_PROFILE_DISCRIMINATOR: [u8; 8] = [225, 205, 234, 143, 17, 186, 50, 220];
const CREATE_RESUME_DISCRIMINATOR: [u8; 8] = [197, 76, 123, 247, 186, 23, 70, 255];
const SET_VISIBILITY_DISCRIMINATOR: [u8; 8] = [33, 151, 83, 247, 61, 13, 48, 223];
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

fn set_visibility_instruction(owner: &Address, resume: &Address, is_public: bool) -> Instruction {
    let mut data = SET_VISIBILITY_DISCRIMINATOR.to_vec();
    data.push(u8::from(is_public));
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*owner, true),
            AccountMeta::new(*resume, false),
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

fn create_resume(svm: &mut LiteSVM, owner: &Keypair, resume_id: u64) {
    send_instruction(svm, owner, create_resume_instruction(&owner.pubkey(), resume_id))
        .expect("resume creation should succeed");
}

fn set_visibility(
    svm: &mut LiteSVM,
    owner: &Keypair,
    resume: &Address,
    is_public: bool,
) -> Result<(), String> {
    send_instruction(
        svm,
        owner,
        set_visibility_instruction(&owner.pubkey(), resume, is_public),
    )
}

fn resume_is_public(svm: &LiteSVM, resume: &Address) -> bool {
    let account = svm.get_account(resume).expect("resume should exist");
    assert_eq!(&account.data[..8], &RESUME_ACCOUNT_DISCRIMINATOR);
    account.data[64] == 1
}

fn resume_immutable_fields(svm: &LiteSVM, resume: &Address) -> (Address, u64, u64, u64, u8) {
    let account = svm.get_account(resume).expect("resume should exist");
    let owner = Address::new_from_array(account.data[8..40].try_into().unwrap());
    let resume_id = u64::from_le_bytes(account.data[40..48].try_into().unwrap());
    let active_version = u64::from_le_bytes(account.data[48..56].try_into().unwrap());
    let version_count = u64::from_le_bytes(account.data[56..64].try_into().unwrap());
    let bump = account.data[65];
    (owner, resume_id, active_version, version_count, bump)
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

fn setup_with_resume() -> (LiteSVM, Keypair, Address) {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    let resume = resume_address(&owner.pubkey(), 0);
    (svm, owner, resume)
}

#[test]
fn new_resume_defaults_to_private() {
    let (svm, _owner, resume) = setup_with_resume();
    assert!(!resume_is_public(&svm, &resume));
}

#[test]
fn owner_can_toggle_visibility_public_then_private() {
    let (mut svm, owner, resume) = setup_with_resume();

    set_visibility(&mut svm, &owner, &resume, true).expect("set public should succeed");
    assert!(resume_is_public(&svm, &resume));

    set_visibility(&mut svm, &owner, &resume, false).expect("set private should succeed");
    assert!(!resume_is_public(&svm, &resume));
}

#[test]
fn setting_same_visibility_twice_is_idempotent() {
    let (mut svm, owner, resume) = setup_with_resume();

    set_visibility(&mut svm, &owner, &resume, true).unwrap();
    svm.expire_blockhash();
    set_visibility(&mut svm, &owner, &resume, true).expect("repeat public should succeed");
    assert!(resume_is_public(&svm, &resume));

    set_visibility(&mut svm, &owner, &resume, false).unwrap();
    svm.expire_blockhash();
    set_visibility(&mut svm, &owner, &resume, false).expect("repeat private should succeed");
    assert!(!resume_is_public(&svm, &resume));
}

#[test]
fn visibility_change_does_not_mutate_other_resume_fields() {
    let (mut svm, owner, resume) = setup_with_resume();
    let before = resume_immutable_fields(&svm, &resume);

    set_visibility(&mut svm, &owner, &resume, true).unwrap();
    let after = resume_immutable_fields(&svm, &resume);

    assert_eq!(before, after);
    assert!(resume_is_public(&svm, &resume));
}

#[test]
fn owner_can_set_visibility_independently_per_resume() {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    create_resume(&mut svm, &owner, 1);

    let first = resume_address(&owner.pubkey(), 0);
    let second = resume_address(&owner.pubkey(), 1);

    set_visibility(&mut svm, &owner, &first, true).unwrap();
    assert!(resume_is_public(&svm, &first));
    assert!(!resume_is_public(&svm, &second));

    set_visibility(&mut svm, &owner, &second, true).unwrap();
    assert!(resume_is_public(&svm, &first));
    assert!(resume_is_public(&svm, &second));

    set_visibility(&mut svm, &owner, &first, false).unwrap();
    assert!(!resume_is_public(&svm, &first));
    assert!(resume_is_public(&svm, &second));
}

#[test]
fn rejects_visibility_change_by_non_owner() {
    let (mut svm, _owner, resume) = setup_with_resume();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 2_000_000_000).unwrap();

    let instruction = set_visibility_instruction(&attacker.pubkey(), &resume, true);
    assert!(send_instruction(&mut svm, &attacker, instruction).is_err());
    assert!(!resume_is_public(&svm, &resume));
}

#[test]
fn rejects_transaction_that_omits_required_owner_signature() {
    let (mut svm, owner, resume) = setup_with_resume();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 2_000_000_000).unwrap();

    // Instruction marks the real owner as signer, but only the attacker keypair is supplied.
    let instruction = set_visibility_instruction(&owner.pubkey(), &resume, true);
    let mut transaction =
        Transaction::new_unsigned(Message::new(&[instruction], Some(&attacker.pubkey())));
    let sign_result = transaction.try_sign(&[&attacker], svm.latest_blockhash());
    assert!(
        sign_result.is_err(),
        "client must refuse to sign a tx missing the owner signature"
    );
    assert!(!resume_is_public(&svm, &resume));
}

#[test]
fn rejects_visibility_change_on_another_wallets_resume_via_pda_mismatch() {
    let (mut svm, owner) = setup();
    let victim = Keypair::new();
    svm.airdrop(&victim.pubkey(), 2_000_000_000).unwrap();

    create_profile(&mut svm, &owner);
    create_resume(&mut svm, &owner, 0);
    create_profile(&mut svm, &victim);
    create_resume(&mut svm, &victim, 0);

    let victim_resume = resume_address(&victim.pubkey(), 0);
    let owner_resume = resume_address(&owner.pubkey(), 0);

    // Owner signs but targets victim resume PDA — has_one + seeds must reject.
    assert!(set_visibility(&mut svm, &owner, &victim_resume, true).is_err());
    assert!(!resume_is_public(&svm, &victim_resume));
    assert!(!resume_is_public(&svm, &owner_resume));
}

#[test]
fn rejects_unrelated_account_substituted_as_resume() {
    let (mut svm, owner, _resume) = setup_with_resume();
    let decoy = Keypair::new();

    assert!(set_visibility(&mut svm, &owner, &decoy.pubkey(), true).is_err());
}

#[test]
fn rejects_profile_account_substituted_as_resume() {
    let (mut svm, owner, resume) = setup_with_resume();
    let profile = profile_address(&owner.pubkey());

    assert!(set_visibility(&mut svm, &owner, &profile, true).is_err());
    assert!(!resume_is_public(&svm, &resume));
}

#[test]
fn rejects_visibility_change_for_nonexistent_resume() {
    let (mut svm, owner) = setup();
    create_profile(&mut svm, &owner);
    let missing = resume_address(&owner.pubkey(), 0);

    assert!(set_visibility(&mut svm, &owner, &missing, true).is_err());
    assert!(svm.get_account(&missing).is_none());
}
