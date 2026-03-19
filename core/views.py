import json
from random import randint
from datetime import datetime

from django.conf import settings
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST
from django.core.paginator import Paginator, EmptyPage

from .models import User, HelplineContact, PanicLog

# BASIC PAGES
def home(request):
    return render(request, 'home.html')


def about(request):
    return render(request, 'about.html')


# ------------------------------
# USER REGISTRATION & LOGIN
# ------------------------------
def register(request):
    if request.method == "POST":
        username = request.POST.get('username')
        password = request.POST.get('password')
        aadhaar_number = request.POST.get('aadhaar_number')
        contact_number = request.POST.get('contact_number')

        if not username or not password or not aadhaar_number:
            messages.error(request, "All fields are required.")
            return redirect('register')

        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already taken.")
            return redirect('register')

        existing_user = User.objects.filter(aadhaar_number=aadhaar_number).first()
        if existing_user:
            existing_user.delete()

        User.objects.create_user(
            username=username,
            password=password,
            aadhaar_number=aadhaar_number,
            contact_number=contact_number or ''
        )
        messages.success(request, "Registration successful! Please log in.")
        return redirect('login')

    return render(request, 'register.html')


def user_login(request):
    if request.method == "POST":
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('home')
        messages.error(request, "Invalid username or password.")
        return redirect('login')
    return render(request, 'login.html')


@login_required
def user_logout(request):
    logout(request)
    messages.info(request, "Logged out successfully.")
    return redirect('home')


# ------------------------------
# OTP VERIFICATION
# ------------------------------
@login_required
def send_otp(request, otp_type):
    user = request.user
    otp = str(randint(100000, 999999))

    if otp_type == 'aadhaar':
        user.aadhaar_otp = otp
    elif otp_type == 'phone':
        user.phone_otp = otp
    elif otp_type == 'email':
        user.email_otp = otp
    else:
        return JsonResponse({'success': False, 'message': 'Invalid OTP type'})

    user.save()
    print(f"{otp_type.upper()} OTP for {user.username}: {otp}")  # dev only
    return JsonResponse({'success': True, 'otp_type': otp_type})

# ------------------------------
# OTP VERIFICATION (VERIFY)
# ------------------------------
@login_required
@require_POST
def verify_otp(request, otp_type):
    """
    Verify Aadhaar / Phone / Email OTP and update user flags.
    Expects JSON body: {"otp": "123456"}
    """
    user = request.user

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'error': 'Invalid data'}, status=400)

    otp = payload.get('otp')
    if not otp:
        return JsonResponse({'success': False, 'error': 'OTP is required'}, status=400)

    # Aadhaar OTP verify
    if otp_type == 'aadhaar':
        if otp == getattr(user, 'aadhaar_otp', None):
            user.aadhaar_verified = True   # ✅ FIX
            user.aadhaar_otp = ''
            user.save(update_fields=['aadhaar_verified', 'aadhaar_otp'])
            user.check_full_verification()   # 🔥 ADD THIS
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'error': 'Incorrect Aadhaar OTP'}, status=400)

    # Phone OTP verify
    elif otp_type == 'phone':
        if otp == getattr(user, 'phone_otp', None):
            user.phone_verified = True
            user.phone_otp = ''
            user.save(update_fields=['phone_verified', 'phone_otp'])
            user.check_full_verification()   
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'error': 'Incorrect Phone OTP'}, status=400)

    # Email OTP verify
    elif otp_type == 'email':
        if otp == getattr(user, 'email_otp', None):
            user.email_verified = True
            user.email_otp = ''
            user.save(update_fields=['email_verified', 'email_otp'])
            user.check_full_verification()
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'error': 'Incorrect Email OTP'}, status=400)

    return JsonResponse({'success': False, 'error': 'Invalid OTP type'}, status=400)

# ------------------------------
# PANIC ALERT SYSTEM
# ------------------------------
@login_required
@require_POST
def panic_alert(request):
    """
    Save user's panic alert with location.
    """

    user = request.user

    # ✅ Extra safety: allow panic only if profile fully verified
    # (Aadhaar + phone + email — apne model ke hisaab se)
    if not (
        getattr(user, 'aadhaar_verified', False)
        and getattr(user, 'phone_verified', False)
        and getattr(user, 'email_verified', False)
    ):
        return JsonResponse(
            {
                "status": "error",
                "message": "Your profile is not fully verified. Panic alert is locked."
            },
            status=403
        )

    # 🔽 existing logic same rehne do
    try:
        if 'application/json' in request.content_type:
            payload = json.loads(request.body.decode('utf-8'))
            latitude = payload.get('latitude')
            longitude = payload.get('longitude')
            description = payload.get('description', '')
        else:
            latitude = request.POST.get('latitude')
            longitude = request.POST.get('longitude')
            description = request.POST.get('description', '')
    except Exception:
        return JsonResponse({"status": "error", "message": "Invalid request"}, status=400)

    if not latitude or not longitude:
        return JsonResponse({"status": "error", "message": "Coordinates required"}, status=400)

    try:
        lat = float(latitude)
        lng = float(longitude)
    except ValueError:
        return JsonResponse({"status": "error", "message": "Invalid coordinates"}, status=400)

    alert = PanicLog.objects.create(
        user=request.user,
        latitude=lat,
        longitude=lng,
        description=description or ''
    )

    profile_pic = ''
    if hasattr(user, 'profile_picture') and user.profile_picture:
        try:
            profile_pic = request.build_absolute_uri(user.profile_picture.url)
        except Exception:
            profile_pic = str(user.profile_picture)

    data = {
        "id": alert.id,
        "username": user.username,
        "email": user.email or '',
        "contact_number": getattr(user, 'contact_number', ''),
        "aadhaar_number": getattr(user, 'aadhaar_number', ''),
        "latitude": str(alert.latitude),
        "longitude": str(alert.longitude),
        "description": alert.description,
        "timestamp": timezone.localtime(alert.timestamp).strftime("%Y-%m-%d %H:%M:%S"),
        "profile_picture_url": profile_pic
    }
    return JsonResponse({"status": "success", "alert": data})

# ------------------------------
# API ENDPOINT FOR DASHBOARD
# ------------------------------
@require_GET
def api_panic_alerts(request):
    try:
        n = int(request.GET.get('n', 50))
    except (ValueError, TypeError):
        n = 50
    try:
        page = int(request.GET.get('page', 1))
    except (ValueError, TypeError):
        page = 1

    qs = PanicLog.objects.all().order_by('-timestamp')

    # Date filtering
    def parse_dt(s):
        if not s:
            return None
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return timezone.make_aware(datetime.strptime(s, fmt), timezone.get_current_timezone())
            except Exception:
                continue
        return None

    start_date = parse_dt(request.GET.get('start_date'))
    end_date = parse_dt(request.GET.get('end_date'))
    if start_date:
        qs = qs.filter(timestamp__gte=start_date)
    if end_date:
        qs = qs.filter(timestamp__lte=end_date)

    if request.GET.get('verified', '').lower() == 'true':
        qs = qs.filter(user__is_verified=True)

    paginator = Paginator(qs, n)
    try:
        page_obj = paginator.page(page)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)

    alerts = []
    for a in page_obj.object_list:
        user = getattr(a, 'user', None)
        pic_url = ''
        if a.snapshot_profile_pic:
            pic_url = a.snapshot_profile_pic
        elif user and getattr(user, 'profile_picture', None):
            try:
                pic_url = request.build_absolute_uri(user.profile_picture.url)
            except Exception:
                pic_url = str(user.profile_picture)

        alerts.append({
            "id": a.id,
            "latitude": str(a.latitude),
            "longitude": str(a.longitude),
            "username": a.snapshot_username or (user.username if user else "Unknown"),
            "contact_number": a.snapshot_contact or getattr(user, 'contact_number', ''),
            "email": a.snapshot_email or getattr(user, 'email', ''),
            "aadhaar_number": a.snapshot_aadhaar or getattr(user, 'aadhaar_number', ''),
            "profile_picture_url": pic_url,
            "description": a.description or '',
            "timestamp": timezone.localtime(a.timestamp).strftime("%Y-%m-%d %H:%M:%S"),
        })

    meta = {
        "page": page_obj.number,
        "pages": paginator.num_pages,
        "total": paginator.count
    }
    return JsonResponse({"alerts": alerts, "meta": meta})


# ------------------------------
# PROFILE & HELPLINE
# ------------------------------
@login_required
def profile(request):
    user = request.user

    if request.method == "POST":

        # 👉 Check if request is AJAX (image upload)
        if request.FILES and request.headers.get('x-requested-with') == 'XMLHttpRequest':
            user.profile_picture = request.FILES['profile_picture']
            user.save()

            return JsonResponse({
                "success": True,
                "message": "Profile image updated"
            })

        # --------- Normal profile fields ---------
        user.username = request.POST.get('username') or user.username
        user.email = request.POST.get('email') or user.email
        user.contact_number = request.POST.get('contact_number') or user.contact_number
        user.aadhaar_number = request.POST.get('aadhaar_number') or user.aadhaar_number

        # --------- OTP ---------
        aadhaar_otp_entered = request.POST.get('aadhaar_otp')
        phone_otp_entered   = request.POST.get('phone_otp')
        email_otp_entered   = request.POST.get('email_otp')

        if aadhaar_otp_entered:
            if aadhaar_otp_entered == user.aadhaar_otp:
                user.aadhaar_verified = True
                user.aadhaar_otp = ""
                messages.success(request, "Aadhaar verified successfully.")
            else:
                messages.error(request, "Invalid Aadhaar OTP.")

        if phone_otp_entered:
            if phone_otp_entered == user.phone_otp:
                user.phone_verified = True
                user.phone_otp = ""
                messages.success(request, "Phone verified.")
            else:
                messages.error(request, "Invalid Phone OTP.")

        if email_otp_entered:
            if email_otp_entered == user.email_otp:
                user.email_verified = True
                user.email_otp = ""
                messages.success(request, "Email verified.")
            else:
                messages.error(request, "Invalid Email OTP.")

        user.save()
        user.check_full_verification()

        return redirect('profile')

    return render(request, 'profile.html', {'user': user})

@login_required
def helpline(request):
    contacts = HelplineContact.objects.all()
    return render(request, 'helpline.html', {'helpline_contacts': contacts})


# ------------------------------
# ADMIN DASHBOARD LOCK SYSTEM
# ------------------------------
from django.conf import settings
from django.shortcuts import render, redirect
from django.contrib import messages
from django.utils import timezone

# ------------------------------
# ADMIN DASHBOARD LOCK SYSTEM
# ------------------------------

def dashboard(request):
    if not request.session.get('dashboard_unlocked'):
        if request.method == "POST":
            entered = request.POST.get('passcode', '').strip()
            if entered  == getattr(settings, 'DASHBOARD_PASSCODE', ''):
                request.session['dashboard_unlocked'] = True
                messages.success(request, "Dashboard unlocked successfully.")
                
            else:
                messages.error(request, "Invalid passkey. Please try again.")
                return render(request, 'dashboard_unlock.html')

        else:
            return render(request, 'dashboard_unlock.html')
    alerts = PanicLog.objects.all().order_by('-timestamp')[:50]

    data = []
    for a in alerts:
        user = getattr(a, 'user', None)
        pic_url = a.snapshot_profile_pic or ''
        if not pic_url and user and getattr(user, 'profile_picture', None):
            try:
                pic_url = request.build_absolute_uri(user.profile_picture.url)
            except Exception:
                pic_url = str(user.profile_picture)

        data.append({
            "id": a.id,
            "username": a.snapshot_username or (user.username if user else "Unknown"),
            "latitude": str(a.latitude),
            "longitude": str(a.longitude),
            "contact_number": a.snapshot_contact or getattr(user, 'contact_number', ''),
            "email": a.snapshot_email or getattr(user, 'email', ''),
            "aadhaar_number": a.snapshot_aadhaar or getattr(user, 'aadhaar_number', ''),
            "profile_picture_url": pic_url,
            "description": a.description or '',
            "timestamp": timezone.localtime(a.timestamp).strftime("%Y-%m-%d %H:%M:%S"),
        })

    return render(request, 'dashboard.html', {'panic_alerts_json': json.dumps(data)})