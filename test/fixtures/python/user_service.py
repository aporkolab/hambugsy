"""
User service module for testing Python parser
"""
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class User:
    id: int
    name: str
    email: str
    is_active: bool = True


class UserNotFoundException(Exception):
    """Raised when a user is not found"""
    pass


class ValidationError(Exception):
    """Raised when validation fails"""
    pass


class UserService:
    """Service for managing users"""

    def __init__(self):
        self._users: dict[int, User] = {}
        self._next_id = 1

    def create_user(self, name: str, email: str) -> User:
        """
        Create a new user

        Args:
            name: User's name
            email: User's email

        Returns:
            The created user

        Raises:
            ValidationError: If name or email is empty
        """
        if not name or not name.strip():
            raise ValidationError("Name cannot be empty")
        if not email or "@" not in email:
            raise ValidationError("Invalid email format")

        user = User(id=self._next_id, name=name.strip(), email=email.lower())
        self._users[user.id] = user
        self._next_id += 1
        return user

    def get_user(self, user_id: int) -> User:
        """
        Get a user by ID

        Args:
            user_id: The user's ID

        Returns:
            The user

        Raises:
            UserNotFoundException: If user doesn't exist
        """
        if user_id not in self._users:
            raise UserNotFoundException(f"User {user_id} not found")
        return self._users[user_id]

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Find user by email, returns None if not found"""
        email_lower = email.lower()
        for user in self._users.values():
            if user.email == email_lower:
                return user
        return None

    def list_users(self, active_only: bool = False) -> List[User]:
        """
        List all users

        Args:
            active_only: If True, only return active users

        Returns:
            List of users
        """
        users = list(self._users.values())
        if active_only:
            users = [u for u in users if u.is_active]
        return users

    def deactivate_user(self, user_id: int) -> User:
        """Deactivate a user"""
        user = self.get_user(user_id)
        user.is_active = False
        return user

    def delete_user(self, user_id: int) -> bool:
        """
        Delete a user

        Returns:
            True if deleted, False if not found
        """
        if user_id in self._users:
            del self._users[user_id]
            return True
        return False

    def count_users(self) -> int:
        """Get total user count"""
        return len(self._users)

    def apply_discount(self, user_id: int, discount_percent: float) -> float:
        """
        Apply a discount for a user (for premium users)
        BUG: Returns wrong discount calculation
        """
        user = self.get_user(user_id)
        if not user.is_active:
            return 0.0
        # Bug: should be discount_percent but adds 5
        return discount_percent + 5


def create_user_service() -> UserService:
    """Factory function to create UserService"""
    return UserService()
