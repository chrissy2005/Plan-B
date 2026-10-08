$("#logon").click(function() {
    var user = {
                  email: $("#email-input").val(),
                  password: $("#password-input").val(),
          };
    console.log(user); //später rausnehmen

})

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; //KI-Log Nr. 6

$("#logon").click(function() {
    const email = $("#email-input").val();
    const password = $("#password-input").val();

    if (email === "" || password === "") {
        alert("Bitte füllen Sie alle Felder aus.");
        return;
    }

    if (!EMAIL_MUSTER.test(email)) {
        alert("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
        return;
    }

    if (password.length < 6) {
        alert("Das Passwort muss mindestens 6 Zeichen lang sein.");
        return;
    }

    versteckeFehler(); //KI-Log Nr. 7
})

function versteckeFehler() { 
    $("#error-message").text("").prop("hidden", true); //KI-Log Nr. 8
}