from documents.naming import (
    build_beneficiary_identity_filename,
    build_beneficiary_identity_title,
    build_donor_identity_filename,
    build_donor_identity_title,
    build_guardian_identity_filename,
    build_guardian_identity_title,
    build_mandate_document_filename,
    build_mandate_document_title,
)


def test_build_donor_identity_filename():
    assert (
        build_donor_identity_filename("CNI", "Amadou", "Diop", "scan.jpg")
        == "CNI_Amadou_DIOP.pdf"
    )
    assert (
        build_donor_identity_filename("EN", "Fatou", "Sarr", "extrait.PDF")
        == "EN_Fatou_SARR.pdf"
    )


def test_build_donor_identity_title():
    assert build_donor_identity_title("CNI", "Amadou", "Diop") == "CNI_Amadou_DIOP"


def test_build_beneficiary_identity_filename():
    assert (
        build_beneficiary_identity_filename("CNI", "Awa", "Ndiaye", "x.pdf")
        == "CNI_BEN_Awa_NDIAYE.pdf"
    )
    assert build_beneficiary_identity_title("CNI", "Awa", "Ndiaye") == "CNI_BEN_Awa_NDIAYE"


def test_build_guardian_identity_filename():
    assert (
        build_guardian_identity_filename("PASSPORT", "Moussa", "Fall", "x.pdf")
        == "PASSPORT_TUT_Moussa_FALL.pdf"
    )
    assert build_guardian_identity_title("PASSPORT", "Moussa", "Fall") == "PASSPORT_TUT_Moussa_FALL"


def test_build_mandate_document_filename():
    assert (
        build_mandate_document_filename(
            "FAMILY", "Mandat de protection", "REF-2024", "acte.pdf"
        )
        == "MANDAT_FAMILY_Mandat_De_Protection_REF_2024.pdf"
    )
    assert (
        build_mandate_document_title("FAMILY", "Mandat de protection", "REF-2024")
        == "MANDAT_FAMILY_Mandat_De_Protection_REF_2024"
    )
