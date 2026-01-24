"""
Tests for UserService - pytest style
"""
import pytest
from user_service import UserService, User, UserNotFoundException, ValidationError, create_user_service


class TestUserService:
    """Test suite for UserService"""

    @pytest.fixture
    def service(self):
        """Create a fresh UserService for each test"""
        return create_user_service()

    @pytest.fixture
    def sample_user(self, service):
        """Create a sample user"""
        return service.create_user("John Doe", "john@example.com")

    def test_create_user_success(self, service):
        """Test creating a user with valid data"""
        user = service.create_user("Jane Doe", "jane@example.com")

        assert user.id == 1
        assert user.name == "Jane Doe"
        assert user.email == "jane@example.com"
        assert user.is_active is True

    def test_create_user_strips_whitespace(self, service):
        """Test that name whitespace is stripped"""
        user = service.create_user("  John  ", "john@test.com")
        assert user.name == "John"

    def test_create_user_lowercases_email(self, service):
        """Test that email is lowercased"""
        user = service.create_user("John", "JOHN@TEST.COM")
        assert user.email == "john@test.com"

    def test_create_user_empty_name_raises(self, service):
        """Test that empty name raises ValidationError"""
        with pytest.raises(ValidationError):
            service.create_user("", "test@test.com")

    def test_create_user_invalid_email_raises(self, service):
        """Test that invalid email raises ValidationError"""
        with pytest.raises(ValidationError):
            service.create_user("John", "invalid-email")

    def test_get_user_success(self, service, sample_user):
        """Test getting an existing user"""
        user = service.get_user(sample_user.id)
        assert user.name == "John Doe"

    def test_get_user_not_found_raises(self, service):
        """Test that getting non-existent user raises"""
        with pytest.raises(UserNotFoundException):
            service.get_user(999)

    def test_get_user_by_email_found(self, service, sample_user):
        """Test finding user by email"""
        user = service.get_user_by_email("john@example.com")
        assert user is not None
        assert user.name == "John Doe"

    def test_get_user_by_email_not_found(self, service):
        """Test that None is returned when user not found by email"""
        user = service.get_user_by_email("nobody@example.com")
        assert user is None

    def test_list_users_returns_all(self, service):
        """Test listing all users"""
        service.create_user("User1", "user1@test.com")
        service.create_user("User2", "user2@test.com")

        users = service.list_users()
        assert len(users) == 2

    def test_list_users_active_only(self, service):
        """Test listing only active users"""
        user1 = service.create_user("Active", "active@test.com")
        user2 = service.create_user("Inactive", "inactive@test.com")
        service.deactivate_user(user2.id)

        active_users = service.list_users(active_only=True)
        assert len(active_users) == 1
        assert active_users[0].name == "Active"

    def test_deactivate_user(self, service, sample_user):
        """Test deactivating a user"""
        user = service.deactivate_user(sample_user.id)
        assert user.is_active is False

    def test_delete_user_success(self, service, sample_user):
        """Test deleting an existing user"""
        result = service.delete_user(sample_user.id)
        assert result is True
        assert service.count_users() == 0

    def test_delete_user_not_found(self, service):
        """Test deleting non-existent user returns False"""
        result = service.delete_user(999)
        assert result is False

    def test_count_users(self, service):
        """Test counting users"""
        assert service.count_users() == 0
        service.create_user("User1", "u1@test.com")
        assert service.count_users() == 1
        service.create_user("User2", "u2@test.com")
        assert service.count_users() == 2

    def test_apply_discount_correct(self, service, sample_user):
        """
        OUTDATED TEST: This expects 10% but code returns 15%
        """
        discount = service.apply_discount(sample_user.id, 10)
        # Bug: code adds 5, so returns 15 instead of 10
        assert discount == 10  # This will fail!

    def test_apply_discount_inactive_user(self, service, sample_user):
        """Test that inactive users get 0 discount"""
        service.deactivate_user(sample_user.id)
        discount = service.apply_discount(sample_user.id, 10)
        assert discount == 0.0


# Standalone tests using plain assert
def test_user_dataclass():
    """Test User dataclass creation"""
    user = User(id=1, name="Test", email="test@test.com")
    assert user.id == 1
    assert user.is_active is True


def test_user_dataclass_inactive():
    """Test User dataclass with inactive flag"""
    user = User(id=1, name="Test", email="test@test.com", is_active=False)
    assert user.is_active is False


def test_factory_function():
    """Test factory function returns UserService"""
    service = create_user_service()
    assert isinstance(service, UserService)
