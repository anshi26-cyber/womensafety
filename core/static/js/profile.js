// Load Cropper
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js";
document.head.appendChild(script);

let cropper;

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("profileInput");
    const img = document.getElementById("currentProfile");
    const btn = document.getElementById("cropBtn");

    if (!input) return;

    input.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        img.src = url;

        if (cropper) cropper.destroy();

        cropper = new Cropper(img, {
            aspectRatio: 1
        });

        btn.disabled = false;
    });

    btn.addEventListener("click", () => {
        if (!cropper) return;

        cropper.getCroppedCanvas().toBlob(blob => {
            const formData = new FormData();
            formData.append("profile_picture", blob);

            fetch("/profile/", {
                method: "POST",
                body: formData
            }).then(() => location.reload());
        });
    });
});