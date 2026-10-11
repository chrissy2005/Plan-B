const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; //KI-Log Nr. 6

$("#logon").click(function() {
    const email = $("#email-input").val().trim(); //KI-Log Nr. 9
    const password = $("#password-input").val();
    const user = { email: email, password: password };

    console.log(user); //später rausnehmen

    if (email === "" || password === "") {
        zeigeFehler("Bitte füllen Sie alle Felder aus.");
        return;
    }

    if (!EMAIL_MUSTER.test(email)) {
        zeigeFehler("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
        return;
    }
    versteckeFehler(); //KI-Log Nr. 7


    $.ajax({
          url: 'http://localhost:8080/auth',
          type: 'post',
          dataType: 'json',
          contentType: 'application/json',
          success: function (data) {
              console.log(data); //später rausnehmen
              sessionStorage.setItem("token",data.token);
              sessionStorage.setItem("user-id", data.userId);
              window.location.href = "index.html"; //KI-Log Nr. 8
          },
          data: JSON.stringify(user),
          processData: false,
          //KI-Log Nr. 10
          error: function (xhr) {
              if (xhr.status === 400 || xhr.status === 401) {
                  zeigeFehler("E-Mail oder Passwort ist falsch. Prüfen Sie Ihre Eingaben oder registrieren Sie sich.");
              } else if (xhr.status === 0) {
                  zeigeFehler("Der Server ist nicht erreichbar. Versuchen Sie es später erneut.");
              } else {
                  zeigeFehler("Es ist ein unerwarteter Fehler aufgetreten (Code " + xhr.status + "). Versuchen Sie es später erneut.");
              }
          }
      });
})




function versteckeFehler() { 
    $("#error-message").text("").prop("hidden", true); //KI-Log Nr. 7
}

function zeigeFehler(message) {
    $("#error-message").text(message).prop("hidden", false);
}