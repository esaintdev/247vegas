"""Tests for Pydantic schema validation.

Covers: UserCreate, WithdrawRequest, KycSubmitRequest, DepositRequest,
and other request schemas with field validation rules.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.wallet import WithdrawRequest, DepositRequest
from app.schemas.kyc import KycSubmitRequest


class TestUserCreate:
    def test_valid_user(self) -> None:
        user = UserCreate(
            email="test@example.com",
            username="test_user",
            password="StrongP@ss1",
        )
        assert user.email == "test@example.com"
        assert user.username == "test_user"
        assert user.display_name is None

    def test_email_validation(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="not-an-email",
                username="test_user",
                password="StrongP@ss1",
            )

    def test_username_pattern(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                username="invalid username!",
                password="StrongP@ss1",
            )

    def test_username_too_short(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                username="ab",
                password="StrongP@ss1",
            )

    def test_password_missing_uppercase(self) -> None:
        with pytest.raises(ValidationError, match="uppercase"):
            UserCreate(
                email="test@example.com",
                username="test_user",
                password="weakpass1",
            )

    def test_password_missing_digit(self) -> None:
        with pytest.raises(ValidationError, match="digit"):
            UserCreate(
                email="test@example.com",
                username="test_user",
                password="WeakPassWithoutDigit",
            )

    def test_password_too_short(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                username="test_user",
                password="Sh0rt",
            )

    def test_valid_with_display_name(self) -> None:
        user = UserCreate(
            email="test@example.com",
            username="test_user",
            password="StrongP@ss1",
            display_name="Test User",
        )
        assert user.display_name == "Test User"


class TestWithdrawRequest:
    def test_valid_withdrawal(self) -> None:
        req = WithdrawRequest(
            amount=Decimal("50.00"),
            payment_method="bank_transfer",
            bank_code="044",
            account_number="0123456789",
            account_name="John Doe",
        )
        assert req.amount == Decimal("50.00")
        assert req.bank_code == "044"
        assert req.account_number == "0123456789"

    def test_zero_amount_fails(self) -> None:
        with pytest.raises(ValidationError):
            WithdrawRequest(
                amount=Decimal("0"),
                payment_method="bank_transfer",
            )

    def test_negative_amount_fails(self) -> None:
        with pytest.raises(ValidationError):
            WithdrawRequest(
                amount=Decimal("-10"),
                payment_method="bank_transfer",
            )

    def test_minimal_withdrawal(self) -> None:
        """All bank fields default to empty strings."""
        req = WithdrawRequest(
            amount=Decimal("10.00"),
            payment_method="bank_transfer",
        )
        assert req.bank_code == ""
        assert req.account_number == ""
        assert req.account_name == ""


class TestDepositRequest:
    def test_valid_deposit(self) -> None:
        req = DepositRequest(amount=Decimal("100.00"))
        assert req.amount == Decimal("100.00")
        assert req.currency == "USD"

    def test_custom_currency(self) -> None:
        req = DepositRequest(amount=Decimal("50.00"), currency="NGN")
        assert req.currency == "NGN"

    def test_zero_deposit_fails(self) -> None:
        with pytest.raises(ValidationError):
            DepositRequest(amount=Decimal("0"))


class TestKycSubmitRequest:
    def test_valid_passport(self) -> None:
        req = KycSubmitRequest(
            document_type="passport",
            document_number="AB1234567",
            full_name="John Doe",
            date_of_birth="1990-01-15",
            nationality="United States",
            address="123 Main St, New York, NY 10001",
        )
        assert req.document_type == "passport"
        assert req.full_name == "John Doe"

    def test_valid_national_id(self) -> None:
        req = KycSubmitRequest(
            document_type="national_id",
            document_number="NID123456789",
            full_name="Jane Smith",
            date_of_birth="1985-06-20",
            nationality="Canada",
            address="456 Oak Ave, Toronto, ON",
        )
        assert req.document_type == "national_id"

    def test_valid_drivers_license(self) -> None:
        req = KycSubmitRequest(
            document_type="drivers_license",
            document_number="DL-42-123456",
            full_name="Bob Wilson",
            date_of_birth="1988-03-10",
            nationality="UK",
            address="789 Pine Rd, London",
        )
        assert req.document_type == "drivers_license"

    def test_invalid_document_type(self) -> None:
        with pytest.raises(ValidationError):
            KycSubmitRequest(
                document_type="ssn_card",
                document_number="123-45-6789",
                full_name="Test User",
                date_of_birth="1990-01-01",
                nationality="US",
                address="123 Test St",
            )

    def test_invalid_date_format(self) -> None:
        with pytest.raises(ValidationError):
            KycSubmitRequest(
                document_type="passport",
                document_number="AB1234567",
                full_name="Test User",
                date_of_birth="01-15-1990",
                nationality="US",
                address="123 Test St",
            )

    def test_full_name_too_short(self) -> None:
        with pytest.raises(ValidationError):
            KycSubmitRequest(
                document_type="passport",
                document_number="AB1234567",
                full_name="A",
                date_of_birth="1990-01-01",
                nationality="US",
                address="123 Main St",
            )

    def test_address_too_short(self) -> None:
        with pytest.raises(ValidationError):
            KycSubmitRequest(
                document_type="passport",
                document_number="AB1234567",
                full_name="Test User",
                date_of_birth="1990-01-01",
                nationality="US",
                address="AB",
            )

    def test_document_number_too_short(self) -> None:
        with pytest.raises(ValidationError):
            KycSubmitRequest(
                document_type="passport",
                document_number="AB",
                full_name="Test User",
                date_of_birth="1990-01-01",
                nationality="US",
                address="123 Test St",
            )
