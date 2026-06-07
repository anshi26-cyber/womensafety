document.addEventListener('DOMContentLoaded', function () {
    const panicBtn = document.getElementById('panic-btn');

    if (!panicBtn) return;

    panicBtn.addEventListener('click', function () {

        if (!navigator.geolocation) {
            alert('Geolocation not supported');
            return;
        }

        panicBtn.disabled = true;
        panicBtn.innerText = "Sending...";

        navigator.geolocation.getCurrentPosition(
            function (position) {
                fetch("/panic-alert/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": document.querySelector('[name=csrf-token]').content
                    },
                    body: JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })
                })
                .then(() => alert("Alert sent"))
                .catch(() => alert("Error"))
                .finally(() => {
                    panicBtn.disabled = false;
                    panicBtn.innerText = "PANIC ALERT";
                });
            },
            function () {
                alert("Location access denied");
                panicBtn.disabled = false;
            }
        );
    });
});