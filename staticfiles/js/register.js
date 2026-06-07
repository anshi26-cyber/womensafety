document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");

    form.addEventListener("submit", function (e) {
        const pwd = document.getElementById("password").value;
        const cpwd = document.getElementById("confirm_password").value;
        const help = document.getElementById("passwordHelp");

        if (pwd !== cpwd) {
            e.preventDefault();
            help.classList.remove("d-none");
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
});