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
const ISSUER_REGISTRY_SEED: &[u8] = b"issuer-registry";
const ISSUER_SEED: &[u8] = b"issuer";
const CREDENTIAL_SEED: &[u8] = b"credential";
const LINK_GRANT_SEED: &[u8] = b"link-grant";
const ENC_PROFILE_SEED: &[u8] = b"enc-profile";

const CREATE_PROFILE_DISCRIMINATOR: [u8; 8] = [225, 205, 234, 143, 17, 186, 50, 220];
const INITIALIZE_REGISTRY_DISCRIMINATOR: [u8; 8] = [157, 206, 75, 32, 236, 128, 138, 167];
const REGISTER_ISSUER_DISCRIMINATOR: [u8; 8] = [145, 117, 52, 59, 189, 27, 127, 18];
const ISSUE_CREDENTIAL_DISCRIMINATOR: [u8; 8] = [255, 193, 171, 224, 68, 171, 194, 87];
const CREATE_LINK_GRANT_DISCRIMINATOR: [u8; 8] = [164, 180, 10, 203, 76, 35, 147, 72];
const REVOKE_LINK_GRANT_DISCRIMINATOR: [u8; 8] = [146, 93, 37, 141, 118, 5, 239, 178];
const CONSUME_LINK_GRANT_DISCRIMINATOR: [u8; 8] = [91, 32, 29, 230, 78, 16, 71, 37];
const REGISTER_ENC_KEY_DISCRIMINATOR: [u8; 8] = [52, 17, 28, 66, 141, 254, 167, 183];
const ROTATE_ENC_KEY_DISCRIMINATOR: [u8; 8] = [52, 75, 92, 47, 23, 99, 201, 33];
const ENC_PROFILE_DISCRIMINATOR: [u8; 8] = [164, 194, 46, 155, 254, 17, 80, 5];

fn pda(seeds: &[&[u8]]) -> Address {
    Address::find_program_address(seeds, &PROGRAM_ID).0
}

fn profile_address(owner: &Address) -> Address {
    pda(&[PROFILE_SEED, owner.as_ref()])
}

fn registry_address() -> Address {
    pda(&[ISSUER_REGISTRY_SEED])
}

fn issuer_address(issuer: &Address) -> Address {
    pda(&[ISSUER_SEED, issuer.as_ref()])
}

fn credential_address(subject: &Address, id: u64) -> Address {
    pda(&[CREDENTIAL_SEED, subject.as_ref(), &id.to_le_bytes()])
}

fn link_grant_address(credential: &Address, id: u64) -> Address {
    pda(&[LINK_GRANT_SEED, credential.as_ref(), &id.to_le_bytes()])
}

fn enc_profile_address(owner: &Address) -> Address {
    pda(&[ENC_PROFILE_SEED, owner.as_ref()])
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> Result<(), String> {
    let tx = Transaction::new(
        &[payer],
        Message::new(&[ix], Some(&payer.pubkey())),
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

fn setup_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("target/deploy/resume.so");
    svm.add_program_from_file(PROGRAM_ID, path)
        .expect("compiled resume.so required");
    svm
}

fn airdrop(svm: &mut LiteSVM, kp: &Keypair) {
    svm.airdrop(&kp.pubkey(), 2_000_000_000).unwrap();
}

fn register_enc_key_ix(owner: &Address, hash: [u8; 32], version: u32) -> Instruction {
    let mut data = REGISTER_ENC_KEY_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&hash);
    data.extend_from_slice(&version.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*owner, true),
            AccountMeta::new(enc_profile_address(owner), false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn rotate_enc_key_ix(owner: &Address, hash: [u8; 32], version: u32) -> Instruction {
    let mut data = ROTATE_ENC_KEY_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&hash);
    data.extend_from_slice(&version.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(*owner, true),
            AccountMeta::new(enc_profile_address(owner), false),
        ],
        data,
    }
}

// Precomputed: SHA256([7u8; 32])
const SECRET: [u8; 32] = [7; 32];
const SECRET_HASH: [u8; 32] = [
    75, 176, 111, 142, 78, 58, 119, 21, 210, 1, 213, 115, 208, 170, 66, 55, 98, 229, 93, 171, 214,
    26, 44, 2, 39, 143, 165, 108, 198, 210, 148, 224,
];

struct World {
    svm: LiteSVM,
    subject: Keypair,
    credential: Address,
}

fn setup_world_with_credential() -> World {
    let mut svm = setup_svm();
    let authority = Keypair::new();
    let issuer = Keypair::new();
    let subject = Keypair::new();
    airdrop(&mut svm, &authority);
    airdrop(&mut svm, &issuer);
    airdrop(&mut svm, &subject);

    send(
        &mut svm,
        &authority,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(authority.pubkey(), true),
                AccountMeta::new(registry_address(), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: INITIALIZE_REGISTRY_DISCRIMINATOR.to_vec(),
        },
    )
    .unwrap();

    let mut reg = REGISTER_ISSUER_DISCRIMINATOR.to_vec();
    reg.push(1);
    send(
        &mut svm,
        &authority,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(authority.pubkey(), true),
                AccountMeta::new_readonly(registry_address(), false),
                AccountMeta::new_readonly(issuer.pubkey(), false),
                AccountMeta::new(issuer_address(&issuer.pubkey()), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: reg,
        },
    )
    .unwrap();

    send(
        &mut svm,
        &subject,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(subject.pubkey(), true),
                AccountMeta::new(profile_address(&subject.pubkey()), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: CREATE_PROFILE_DISCRIMINATOR.to_vec(),
        },
    )
    .unwrap();

    let mut issue = ISSUE_CREDENTIAL_DISCRIMINATOR.to_vec();
    issue.extend_from_slice(&0u64.to_le_bytes());
    issue.extend_from_slice(&[1; 32]);
    issue.extend_from_slice(&[2; 32]);
    let uri = b"https://example.com/c.json";
    issue.extend_from_slice(&(uri.len() as u32).to_le_bytes());
    issue.extend_from_slice(uri);
    issue.push(0);
    send(
        &mut svm,
        &issuer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(issuer.pubkey(), true),
                AccountMeta::new_readonly(issuer_address(&issuer.pubkey()), false),
                AccountMeta::new_readonly(subject.pubkey(), false),
                AccountMeta::new(profile_address(&subject.pubkey()), false),
                AccountMeta::new(credential_address(&subject.pubkey(), 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data: issue,
        },
    )
    .unwrap();

    let credential = credential_address(&subject.pubkey(), 0);
    World {
        svm,
        subject,
        credential,
    }
}

fn create_link_grant(world: &mut World, max_uses: u32, expires_at: i64) {
    let wrapped = vec![9u8; 32];
    let mut data = CREATE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&SECRET_HASH);
    data.extend_from_slice(&(wrapped.len() as u32).to_le_bytes());
    data.extend_from_slice(&wrapped);
    data.extend_from_slice(&expires_at.to_le_bytes());
    data.extend_from_slice(&max_uses.to_le_bytes());
    send(
        &mut world.svm,
        &world.subject,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.subject.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            ],
            data,
        },
    )
    .expect("create link grant");
}

fn consume_link(world: &mut World, consumer: &Keypair, secret: [u8; 32]) -> Result<(), String> {
    let mut data = CONSUME_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    data.extend_from_slice(&secret);
    send(
        &mut world.svm,
        consumer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new_readonly(consumer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
            ],
            data,
        },
    )
}

fn link_use_count(svm: &LiteSVM, credential: &Address) -> u32 {
    let account = svm
        .get_account(&link_grant_address(credential, 0))
        .unwrap();
    // disc+cred+grantor+hash = 104, then vec len at 104
    let key_len = u32::from_le_bytes(account.data[104..108].try_into().unwrap()) as usize;
    let offset = 108 + key_len + 8 + 8; // after created_at + expires_at
    u32::from_le_bytes(account.data[offset..offset + 4].try_into().unwrap())
}

fn link_status(svm: &LiteSVM, credential: &Address) -> u8 {
    let account = svm
        .get_account(&link_grant_address(credential, 0))
        .unwrap();
    let key_len = u32::from_le_bytes(account.data[104..108].try_into().unwrap()) as usize;
    let offset = 108 + key_len + 8 + 8 + 4 + 4;
    account.data[offset]
}

#[test]
fn registers_and_rotates_encryption_profile() {
    let mut svm = setup_svm();
    let owner = Keypair::new();
    airdrop(&mut svm, &owner);

    send(
        &mut svm,
        &owner,
        register_enc_key_ix(&owner.pubkey(), [1; 32], 1),
    )
    .unwrap();
    let profile = enc_profile_address(&owner.pubkey());
    let account = svm.get_account(&profile).unwrap();
    assert_eq!(account.data.len(), 117);
    assert_eq!(&account.data[..8], &ENC_PROFILE_DISCRIMINATOR);
    assert_eq!(&account.data[8..40], owner.pubkey().as_ref());
    assert_eq!(&account.data[40..44], &1u32.to_le_bytes());
    assert_eq!(&account.data[44..76], &[1; 32]);

    send(
        &mut svm,
        &owner,
        rotate_enc_key_ix(&owner.pubkey(), [2; 32], 2),
    )
    .unwrap();
    let account = svm.get_account(&profile).unwrap();
    assert_eq!(&account.data[40..44], &2u32.to_le_bytes());
    assert_eq!(&account.data[44..76], &[2; 32]);
}

#[test]
fn rejects_encryption_profile_security_failures() {
    let mut svm = setup_svm();
    let owner = Keypair::new();
    let attacker = Keypair::new();
    airdrop(&mut svm, &owner);
    airdrop(&mut svm, &attacker);

    assert!(send(
        &mut svm,
        &owner,
        register_enc_key_ix(&owner.pubkey(), [0; 32], 1)
    )
    .is_err());
    assert!(send(
        &mut svm,
        &owner,
        register_enc_key_ix(&owner.pubkey(), [1; 32], 2)
    )
    .is_err());

    send(
        &mut svm,
        &owner,
        register_enc_key_ix(&owner.pubkey(), [1; 32], 1),
    )
    .unwrap();
    assert!(send(
        &mut svm,
        &owner,
        register_enc_key_ix(&owner.pubkey(), [3; 32], 1)
    )
    .is_err());
    // Attacker signs but targets the owner's profile PDA — seeds/has_one must reject.
    assert!(send(
        &mut svm,
        &attacker,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new_readonly(attacker.pubkey(), true),
                AccountMeta::new(enc_profile_address(&owner.pubkey()), false),
            ],
            data: {
                let mut data = ROTATE_ENC_KEY_DISCRIMINATOR.to_vec();
                data.extend_from_slice(&[9; 32]);
                data.extend_from_slice(&2u32.to_le_bytes());
                data
            },
        },
    )
    .is_err());
    assert!(send(
        &mut svm,
        &owner,
        rotate_enc_key_ix(&owner.pubkey(), [1; 32], 2)
    )
    .is_err());
    assert!(send(
        &mut svm,
        &owner,
        rotate_enc_key_ix(&owner.pubkey(), [2; 32], 3)
    )
    .is_err());
}

#[test]
fn consume_link_grant_enforces_secret_expiry_and_max_uses() {
    let mut world = setup_world_with_credential();
    let consumer = Keypair::new();
    airdrop(&mut world.svm, &consumer);

    create_link_grant(&mut world, 2, 4_000_000_000);
    consume_link(&mut world, &consumer, SECRET).unwrap();
    assert_eq!(link_use_count(&world.svm, &world.credential), 1);
    assert_eq!(link_status(&world.svm, &world.credential), 0);

    assert!(consume_link(&mut world, &consumer, [8; 32]).is_err());
    assert_eq!(link_use_count(&world.svm, &world.credential), 1);

    world.svm.expire_blockhash();
    consume_link(&mut world, &consumer, SECRET).unwrap();
    assert_eq!(link_use_count(&world.svm, &world.credential), 2);
    assert_eq!(link_status(&world.svm, &world.credential), 1); // auto-revoked after max uses

    world.svm.expire_blockhash();
    assert!(consume_link(&mut world, &consumer, SECRET).is_err());
}

#[test]
fn rejects_consume_after_manual_revoke_and_wrong_pda() {
    let mut world = setup_world_with_credential();
    let consumer = Keypair::new();
    airdrop(&mut world.svm, &consumer);
    create_link_grant(&mut world, 5, 4_000_000_000);

    let mut data = REVOKE_LINK_GRANT_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&0u64.to_le_bytes());
    send(
        &mut world.svm,
        &world.subject,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(world.subject.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(link_grant_address(&world.credential, 0), false),
            ],
            data,
        },
    )
    .unwrap();

    assert!(consume_link(&mut world, &consumer, SECRET).is_err());

    let decoy = Keypair::new();
    let mut bad = CONSUME_LINK_GRANT_DISCRIMINATOR.to_vec();
    bad.extend_from_slice(&0u64.to_le_bytes());
    bad.extend_from_slice(&SECRET);
    assert!(send(
        &mut world.svm,
        &consumer,
        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new_readonly(consumer.pubkey(), true),
                AccountMeta::new_readonly(world.credential, false),
                AccountMeta::new(decoy.pubkey(), false),
            ],
            data: bad,
        },
    )
    .is_err());
}
