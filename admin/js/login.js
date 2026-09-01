import { supabase }
from "../../js/supabase.js";


const loginForm =
  document.getElementById(
    "loginForm"
  );


const emailInput =
  document.getElementById(
    "email"
  );


const passwordInput =
  document.getElementById(
    "password"
  );


const loginBtn =
  document.getElementById(
    "loginBtn"
  );


const loginMessage =
  document.getElementById(
    "loginMessage"
  );


// ========================================
// CHECK EXISTING SESSION
// ========================================

async function checkSession() {

  const {
    data: {
      session
    }
  } =
    await supabase.auth
      .getSession();


  if (!session) {
    return;
  }


  const isAdmin =
    await checkAdmin(
      session.user.id
    );


  if (isAdmin) {

    window.location.replace(
      "dashboard.html"
    );

  }

}


async function checkAdmin(
  userId
) {

  const {
    data,
    error
  } =
    await supabase
      .from("admins")
      .select("user_id")
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();


  if (error) {

    console.error(
      error
    );

    return false;
  }


  return !!data;

}


// ========================================
// LOGIN
// ========================================

loginForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    loginMessage.textContent =
      "";


    loginBtn.disabled =
      true;


    loginBtn.innerHTML =
      `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Signing in...
      `;


    const {
      data,
      error
    } =
      await supabase.auth
        .signInWithPassword({

          email:
            emailInput.value.trim(),

          password:
            passwordInput.value

        });


    if (error) {

      showError(
        error.message
      );

      resetButton();

      return;
    }


    const isAdmin =
      await checkAdmin(
        data.user.id
      );


    if (!isAdmin) {

      await supabase.auth
        .signOut();


      showError(
        "You are not authorized to access the JStaroma admin portal."
      );


      resetButton();

      return;
    }


    window.location.replace(
      "dashboard.html"
    );

  }
);


function showError(
  message
) {

  loginMessage.textContent =
    message;


  loginMessage.className =
    "form-message error";

}


function resetButton() {

  loginBtn.disabled =
    false;


  loginBtn.innerHTML =
    `
      <i class="fa-solid fa-right-to-bracket"></i>
      Sign In
    `;

}


checkSession();