document.addEventListener("DOMContentLoaded", () => {

    /*====================================
            ELEMENTS
    ====================================*/

    const profileInput = document.getElementById("profileInput");
    const currentProfile = document.getElementById("currentProfile");
    const cropBtn = document.getElementById("cropBtn");

    let cropper = null;

    const csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.content;

    /*====================================
        PROFILE IMAGE PREVIEW
    ====================================*/

    if (profileInput) {

        profileInput.addEventListener("change", function (e) {

            const file = e.target.files[0];

            if (!file) return;

            const url = URL.createObjectURL(file);

            currentProfile.src = url;

            if (cropper) {
                cropper.destroy();
            }

            cropper = new Cropper(currentProfile, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: "move",
                autoCropArea: 1,
                responsive: true,
                background: false
            });

            cropBtn.disabled = false;

        });

    }

    /*====================================
            IMAGE UPLOAD
    ====================================*/

    if (cropBtn) {

        cropBtn.addEventListener("click", function () {

            if (!cropper) {

                alert("Please choose an image first.");

                return;

            }

            cropBtn.disabled = true;
            cropBtn.innerText = "Uploading...";

            cropper.getCroppedCanvas({

                width: 500,
                height: 500

            }).toBlob(function (blob) {

                const formData = new FormData();

                formData.append(
                    "profile_picture",
                    blob,
                    "profile.png"
                );

                fetch("/profile/", {

                    method: "POST",

                    headers: {

                        "X-CSRFToken": csrfToken,

                        "X-Requested-With": "XMLHttpRequest"

                    },

                    body: formData

                })

                .then(response => {

                    if (!response.ok) {

                        throw new Error("Upload failed");

                    }

                    return response.json();

                })

                .then(data => {

                    if (data.success) {

                        alert("✅ Profile picture updated.");

                        setTimeout(() => {

                            location.reload();

                        }, 800);

                    } else {

                        alert(data.message || "Upload failed.");

                    }

                })

                .catch(error => {

                    console.error(error);

                    alert("Something went wrong.");

                })

                .finally(() => {

                    cropBtn.disabled = false;
                    cropBtn.innerText = "Upload Picture";

                });

            });

        });

    }

});


/*====================================
            SEND OTP
====================================*/

function sendOtp(type) {

    fetch(`/send-otp/${type}/`, {

        headers: {

            "X-Requested-With": "XMLHttpRequest"

        }

    })

    .then(response => {

        if (!response.ok) {

            throw new Error();

        }

        return response.json();

    })

    .then(data => {

        if (data.success) {

            alert("OTP Sent Successfully.");

            const box = document.getElementById(`${type}-otp-box`);

            if (box) {

                box.classList.remove("d-none");

            }

        } else {

            alert(data.message || "Failed to send OTP.");

        }

    })

    .catch(() => {

        alert("Unable to send OTP.");

    });

}


/*====================================
            VERIFY OTP
====================================*/

function verifyOtp(type) {

    const input = document.getElementById(`${type}-otp`);

    if (!input) return;

    const otp = input.value.trim();

    if (otp === "") {

        alert("Please enter OTP.");

        return;

    }

    fetch(`/verify-otp/${type}/`, {

        method: "POST",

        headers: {

            "Content-Type": "application/json",

            "X-CSRFToken":
                document.querySelector('meta[name="csrf-token"]').content

        },

        body: JSON.stringify({

            otp: otp

        })

    })

    .then(response => {

        if (!response.ok) {

            throw new Error();

        }

        return response.json();

    })

    .then(data => {

        if (data.success) {

            alert(type.toUpperCase() + " Verified Successfully.");

            const otpBox = document.getElementById(`${type}-otp-box`);

            if (otpBox) {

                otpBox.classList.add("d-none");

            }

            const card = input.closest(".verify-card");

            if (card) {

                const oldBadge = card.querySelector(".badge");

                if (oldBadge) {

                    oldBadge.remove();

                }

                const badge = document.createElement("span");

                badge.className =
                    "badge bg-success";

                badge.innerText = "Verified";

                card.querySelector("h5")
                    .parentElement
                    .appendChild(badge);

            }

        } else {

            alert(data.message || "Invalid OTP.");

        }

    })

    .catch(() => {

        alert("Verification failed.");

    });

}