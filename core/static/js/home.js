document.addEventListener("DOMContentLoaded", () => {

    const panicBtn = document.getElementById("panic-btn");

    if (!panicBtn) return;

    const modal = document.getElementById("sos-modal");
    const countdown = document.getElementById("countdown");
    const cancelBtn = document.getElementById("cancel-sos");
    const progressBar = document.getElementById("progress-bar");

    let countdownTimer = null;

    // -------------------------
    // Send SOS
    // -------------------------
    function sendSOS() {

        if (!navigator.geolocation) {
            alert("Geolocation not supported.");
            modal.style.display = "none";
            return;
        }

        navigator.geolocation.getCurrentPosition(

            function(position){

                fetch("/panic-alert/",{
                    method:"POST",
                    headers:{
                        "Content-Type":"application/json",
                        "X-CSRFToken":document.querySelector('meta[name="csrf-token"]').content
                    },
                    body:JSON.stringify({
                        latitude:position.coords.latitude,
                        longitude:position.coords.longitude
                    })
                })

                .then(response => response.json())

                .then(data => {

                    modal.style.display = "none";

                    if(data.status === "success"){
                        alert("🚨 SOS Alert Sent Successfully");
                    }else{
                        alert(data.message || "Failed to send alert");
                    }

                })

                .catch(error => {

                    console.error(error);
                    modal.style.display = "none";
                    alert("Something went wrong.");

                });

            },

            function(){

                modal.style.display = "none";
                alert("Location permission denied.");

            }

        );

    }

    // -------------------------
    // Countdown
    // -------------------------
    function startCountdown(){

        modal.style.display = "flex";

        let seconds = 5;

        countdown.innerText = seconds;

        progressBar.style.width = "100%";

        clearInterval(countdownTimer);

        countdownTimer = setInterval(() => {

seconds--;

if (seconds <= 0) {

    countdown.innerText = "Sending...";

    progressBar.style.width = "0%";

    clearInterval(countdownTimer);

    sendSOS();

    return;
}

countdown.innerText = seconds;

progressBar.style.width = (seconds / 5) * 100 + "%";

        },1000);

    }

    // -------------------------
    // Panic Button Click
    // -------------------------
    panicBtn.addEventListener("click", () => {

        startCountdown();

    });

    // -------------------------
    // Cancel Button
    // -------------------------
    cancelBtn.addEventListener("click", () => {

        clearInterval(countdownTimer);

        progressBar.style.width = "100%";

        modal.style.display = "none";

    });

});