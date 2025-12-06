from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.utils import timezone


# Aadhaar validator: exactly 12 digits
aadhaar_validator = RegexValidator(
    regex=r'^\d{12}$',
    message='Aadhaar number must be exactly 12 digits.'
)


class User(AbstractUser):
    """
    Custom user model extending AbstractUser.
    Keep username as the primary login field (ensure AUTH_USER_MODEL set).
    """
    username = models.CharField(max_length=150, unique=True, null=False, blank=False)
    aadhaar_number = models.CharField(
        max_length=12,
        unique=True,
        validators=[aadhaar_validator],
        help_text="12 digit Aadhaar number"
    )
    contact_number = models.CharField(max_length=15, blank=True, default='')
    is_verified = models.BooleanField(default=False)  # True if all verifications done
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)

    # OTP fields
    phone_otp = models.CharField(max_length=6, blank=True, null=True)
    email_otp = models.CharField(max_length=6, blank=True, null=True)
    aadhaar_otp = models.CharField(max_length=6, blank=True, null=True)

    # Verification flags
    phone_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    aadhaar_verified = models.BooleanField(default=False)

    # Role flag: responders / police can be marked True
    is_responder = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['aadhaar_number']),
        ]
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def __str__(self):
        return self.username

    def check_full_verification(self):
        """Check if all verifications are complete and update is_verified flag."""
        if self.phone_verified and self.email_verified and self.aadhaar_verified:
            if not self.is_verified:
                self.is_verified = True
                self.save(update_fields=['is_verified'])
        else:
            if self.is_verified:
                self.is_verified = False
                self.save(update_fields=['is_verified'])
        return self.is_verified

    def save(self, *args, **kwargs):
        # Ensure username exists (AbstractUser normally enforces)
        if not self.username:
            self.username = f"user{int(timezone.now().timestamp())}"
        super().save(*args, **kwargs)


class HelplineContact(models.Model):
    name = models.CharField(max_length=200)
    phone_number = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class PanicLog(models.Model):
    """
    Stores a panic alert. Snapshot fields store user profile data at the time of alert so history is immutable.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    # Snapshot fields (immutable history)
    snapshot_full_name = models.CharField(max_length=200, blank=True, null=True)
    snapshot_username = models.CharField(max_length=150, blank=True, null=True)
    snapshot_email = models.EmailField(blank=True, null=True)
    snapshot_contact = models.CharField(max_length=30, blank=True, null=True)
    snapshot_aadhaar = models.CharField(max_length=30, blank=True, null=True)
    snapshot_profile_pic = models.URLField(blank=True, null=True)  # store absolute URL

    description = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    # audit fields
    request_ip = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.CharField(max_length=512, blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        who = self.snapshot_username or (self.user.username if self.user else 'Anonymous')
        return f"Panic by {who} @ {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    def save(self, *args, **kwargs):
        # Ensure snapshot fields fallback to user data if missing
        if self.user:
            if not self.snapshot_username:
                self.snapshot_username = getattr(self.user, 'username', '') or self.snapshot_username
            if not self.snapshot_full_name:
                try:
                    name = self.user.get_full_name() if hasattr(self.user, 'get_full_name') else ''
                except Exception:
                    name = getattr(self.user, 'full_name', '')
                self.snapshot_full_name = name or self.snapshot_full_name
            if not self.snapshot_email:
                self.snapshot_email = getattr(self.user, 'email', '') or self.snapshot_email
            if not self.snapshot_contact:
                self.snapshot_contact = getattr(self.user, 'contact_number', '') or self.snapshot_contact
            if not self.snapshot_aadhaar:
                self.snapshot_aadhaar = getattr(self.user, 'aadhaar_number', '') or self.snapshot_aadhaar
            # snapshot_profile_pic intentionally left to be set by view (absolute URL preferred)
        super().save(*args, **kwargs)
