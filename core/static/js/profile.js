// -------------------------
// Load Cropper (safe load)
// -------------------------
if (typeof Cropper === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js";
    document.head.appendChild(script);
}

// -------------------------
// PROFILE IMAGE UPLOAD
// -------------------------
let cropper;
const input = document.getElementById('profileInput');
const image = document.getElementById('currentProfile');
const cropBtn = document.getElementById('cropBtn');

input?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    image.src = url;

    if (cropper) cropper.destroy();

    cropper = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 1
    });

    cropBtn.disabled = false;
});

cropBtn?.addEventListener('click', () => {
    if (!cropper) {
        alert("Select image first");
        return;
    }

    cropper.getCroppedCanvas().toBlob(blob => {
        const formData = new FormData();
        formData.append('profile_picture', blob, 'profile.png');

        fetch("/profile/", {
            method: "POST",
            headers: {
                "X-CSRFToken": document.querySelector('meta[name="csrf-token"]').content,
                "X-Requested-With": "XMLHttpRequest"
            },
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Profile updated!");
                location.reload();
            } else {
                alert("Upload failed");
            }
        })
        .catch(() => alert("Error uploading image"));
    });
});


// -------------------------
// OTP SYSTEM
// -------------------------

// SEND OTP
function sendOtp(type) {
    fetch(`/send-otp/${type}/`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("OTP sent!");

                const box = document.getElementById(`${type}-otp-box`);
                if (box) box.classList.remove("d-none");
            } else {
                alert("Failed to send OTP");
            }
        })
        .catch(() => alert("Error sending OTP"));
}


// VERIFY OTP
function verifyOtp(type) {
    const input = document.getElementById(`${type}-otp`);
    if (!input) return;

    const otp = input.value.trim();

    if (!otp) {
        alert("Enter OTP first");
        return;
    }

    fetch(`/verify-otp/${type}/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ otp: otp })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`${type.toUpperCase()} verified!`);

            // hide OTP box
            document.getElementById(`${type}-otp-box`)?.classList.add("d-none");

            // show verified badge (dynamic)
            const parent = input.closest('.mb-3');
            if (parent) {
                const badge = document.createElement("span");
                badge.className = "badge bg-success mt-2";
                badge.innerText = "✔ Verified";
                parent.appendChild(badge);
            }

        } else {
            alert("Wrong OTP");
        }
    })
    .catch(() => alert("Verification error"));
}