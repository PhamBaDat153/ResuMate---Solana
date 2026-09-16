use anchor_lang::Space;
use resume::state::{Credential, Issuer, IssuerRegistry, Resume, ResumeVersion, UserProfile};

#[test]
fn account_sizes_include_bounded_uri_storage() {
    assert_eq!(UserProfile::INIT_SPACE, 81);
    assert_eq!(Resume::INIT_SPACE, 90);
    assert_eq!(ResumeVersion::INIT_SPACE, 350);
    assert_eq!(IssuerRegistry::INIT_SPACE, 97);
    assert_eq!(Issuer::INIT_SPACE, 99);
    assert_eq!(Credential::INIT_SPACE, 360);
}

#[test]
fn pda_seed_components_fit_runtime_limits() {
    assert!(resume::constants::PROFILE_SEED.len() <= 32);
    assert!(resume::constants::RESUME_SEED.len() <= 32);
    assert!(resume::constants::RESUME_VERSION_SEED.len() <= 32);
    assert!(resume::constants::ISSUER_REGISTRY_SEED.len() <= 32);
    assert!(resume::constants::ISSUER_SEED.len() <= 32);
    assert!(resume::constants::CREDENTIAL_SEED.len() <= 32);
}
